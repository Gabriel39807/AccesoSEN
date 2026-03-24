from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import get_connection
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone

from .models import PasswordResetOTP, Usuario
from core.institution_settings import INSTITUTION_NAME


def _positive_setting(name: str, default: int, *, minimum: int = 1, maximum: int | None = None) -> int:
    raw = getattr(settings, name, default)
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = default
    value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


OTP_CODE_LENGTH = _positive_setting("OTP_CODE_LENGTH", 5, minimum=4, maximum=8)
OTP_TTL_MINUTES = _positive_setting("OTP_TTL_MINUTES", 5, minimum=1, maximum=30)
OTP_MAX_ATTEMPTS = _positive_setting("OTP_MAX_ATTEMPTS", 5, minimum=3, maximum=10)
OTP_MAX_REQUESTS = _positive_setting("OTP_MAX_REQUESTS", 3, minimum=1, maximum=10)
OTP_REQUEST_WINDOW_SEC = _positive_setting("OTP_REQUEST_WINDOW_SEC", 5 * 60, minimum=60, maximum=60 * 60)
OTP_REQUEST_LOCK_SEC = _positive_setting("OTP_REQUEST_LOCK_SEC", 15 * 60, minimum=60, maximum=24 * 60 * 60)
logger = logging.getLogger(__name__)


def _mask_email(value: str) -> str:
    text = (value or "").strip()
    if "@" not in text:
        return "***"
    local, domain = text.split("@", 1)
    if len(local) <= 2:
        return f"***@{domain}"
    return f"{local[0]}***{local[-1]}@{domain}"


def hash_code(salt: str, code: str) -> str:
    return hashlib.sha256(f"{salt}:{code}".encode("utf-8")).hexdigest()


def generate_otp_code() -> str:
    upper_bound = 10**OTP_CODE_LENGTH
    return f"{secrets.randbelow(upper_bound):0{OTP_CODE_LENGTH}d}"


def _smtp_backend_enabled() -> bool:
    backend = str(getattr(settings, "EMAIL_BACKEND", "") or "").strip()
    return backend == "django.core.mail.backends.smtp.EmailBackend"


def _normalize_smtp_password(password: str) -> str:
    raw = str(password or "")
    if not raw:
        return ""

    compact = "".join(raw.split())
    if compact == raw:
        return raw

    host = str(getattr(settings, "EMAIL_HOST", "") or "").strip().lower()
    if host in {"smtp.gmail.com", "smtp.googlemail.com"} and len(compact) == 16:
        logger.warning("smtp_password_whitespace_normalized host=%s", host)
        return compact

    return raw


def _build_email_connection() -> tuple[object | None, str]:
    from_email = str(getattr(settings, "DEFAULT_FROM_EMAIL", "") or "").strip()
    if not from_email:
        raise ImproperlyConfigured("DEFAULT_FROM_EMAIL is required for OTP email delivery.")

    if not _smtp_backend_enabled():
        return get_connection(fail_silently=False), from_email

    host = str(getattr(settings, "EMAIL_HOST", "") or "").strip()
    port = int(getattr(settings, "EMAIL_PORT", 0) or 0)
    username = str(getattr(settings, "EMAIL_HOST_USER", "") or "").strip()
    password = _normalize_smtp_password(getattr(settings, "EMAIL_HOST_PASSWORD", ""))
    use_tls = bool(getattr(settings, "EMAIL_USE_TLS", False))
    use_ssl = bool(getattr(settings, "EMAIL_USE_SSL", False))

    missing = []
    if not host:
        missing.append("EMAIL_HOST")
    if port <= 0:
        missing.append("EMAIL_PORT")
    if not username:
        missing.append("EMAIL_HOST_USER")
    if not password:
        missing.append("EMAIL_HOST_PASSWORD")
    if missing:
        raise ImproperlyConfigured(f"Missing email settings for OTP delivery: {', '.join(missing)}")
    if use_tls and use_ssl:
        raise ImproperlyConfigured("EMAIL_USE_TLS and EMAIL_USE_SSL cannot both be true.")

    connection = get_connection(
        backend=getattr(settings, "EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend"),
        fail_silently=False,
        host=host,
        port=port,
        username=username,
        password=password,
        use_tls=use_tls,
        use_ssl=use_ssl,
        timeout=getattr(settings, "EMAIL_TIMEOUT", None),
    )
    return connection, from_email


def invalidate_active_password_reset_otps(user: Usuario):
    if not getattr(user, "id", None):
        return 0
    return PasswordResetOTP.objects.filter(
        user=user,
        used_at__isnull=True,
        channel=PasswordResetOTP.Channel.EMAIL,
    ).update(used_at=timezone.now())


def create_otp_for_user(user: Usuario) -> tuple[PasswordResetOTP, str]:
    code = generate_otp_code()
    salt = secrets.token_hex(16)
    with transaction.atomic():
        invalidate_active_password_reset_otps(user)
        otp = PasswordResetOTP.objects.create(
            user=user,
            salt=salt,
            code_hash=hash_code(salt, code),
            expires_at=timezone.now() + timedelta(minutes=OTP_TTL_MINUTES),
            channel=PasswordResetOTP.Channel.EMAIL,
        )
    logger.info("otp_created user_id=%s channel=%s", getattr(user, "id", None), PasswordResetOTP.Channel.EMAIL)
    return otp, code


def send_password_reset_email(to_email: str, code: str):
    connection, from_email = _build_email_connection()
    subject = f"{INSTITUTION_NAME} - Codigo de recuperacion"
    context = {"otp": code, "ttl_minutes": OTP_TTL_MINUTES, "email": to_email, "institution_name": INSTITUTION_NAME}

    text_body = (
        f"Tu codigo de recuperacion de {INSTITUTION_NAME} es: {code}\n\n"
        f"Este codigo vence en {OTP_TTL_MINUTES} minutos.\n"
        "Si no solicitaste este cambio, ignora este mensaje."
    )

    html_body = None
    try:
        html_body = render_to_string("emails/password_reset_otp.html", context)
    except Exception:
        html_body = None

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=from_email,
        to=[to_email],
        connection=connection,
    )
    if html_body:
        msg.attach_alternative(html_body, "text/html")
    try:
        msg.send(fail_silently=False)
    except Exception:
        logger.exception("otp_email_send_failed recipient=%s", _mask_email(to_email))
        raise
    logger.info("otp_email_sent recipient=%s", _mask_email(to_email))


def send_control_panel_otp_email(to_email: str, code: str):
    connection, from_email = _build_email_connection()
    subject = f"{INSTITUTION_NAME} - Codigo de verificacion del panel"
    text_body = (
        f"Tu codigo de verificacion del panel de control de {INSTITUTION_NAME} es: {code}\n\n"
        f"Este codigo vence en {OTP_TTL_MINUTES} minutos.\n"
        "Si no solicitaste este acceso, ignora este mensaje."
    )
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=from_email,
        to=[to_email],
        connection=connection,
    )
    try:
        msg.send(fail_silently=False)
    except Exception:
        logger.exception("control_panel_otp_email_send_failed recipient=%s", _mask_email(to_email))
        raise
    logger.info("control_panel_otp_email_sent recipient=%s", _mask_email(to_email))
