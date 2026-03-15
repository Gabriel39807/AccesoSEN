from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from .models import PasswordResetOTP, Usuario
from core.institution_settings import INSTITUTION_NAME

OTP_TTL_MINUTES = 5
OTP_MAX_ATTEMPTS = 5
OTP_MAX_REQUESTS = 3
OTP_REQUEST_WINDOW_SEC = 5 * 60
OTP_REQUEST_LOCK_SEC = 15 * 60
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
    return f"{secrets.randbelow(10**5):05d}"


def create_otp_for_user(user: Usuario) -> tuple[PasswordResetOTP, str]:
    code = generate_otp_code()
    salt = secrets.token_hex(16)
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
