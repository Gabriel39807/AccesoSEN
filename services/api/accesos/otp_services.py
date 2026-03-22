from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import timedelta

from django.conf import settings
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
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@sadi.local"),
        to=[to_email],
    )
    if html_body:
        msg.attach_alternative(html_body, "text/html")
    msg.send(fail_silently=False)
    logger.info("otp_email_sent recipient=%s", _mask_email(to_email))


def send_control_panel_otp_email(to_email: str, code: str):
    subject = f"{INSTITUTION_NAME} - Codigo de verificacion del panel"
    text_body = (
        f"Tu codigo de verificacion del panel de control de {INSTITUTION_NAME} es: {code}\n\n"
        f"Este codigo vence en {OTP_TTL_MINUTES} minutos.\n"
        "Si no solicitaste este acceso, ignora este mensaje."
    )
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@sadi.local"),
        to=[to_email],
    )
    msg.send(fail_silently=False)
    logger.info("control_panel_otp_email_sent recipient=%s", _mask_email(to_email))
