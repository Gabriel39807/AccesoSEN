from __future__ import annotations

import hashlib
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from .models import PasswordResetOTP, Usuario

OTP_TTL_MINUTES = 5
OTP_MAX_ATTEMPTS = 5
OTP_MAX_REQUESTS = 3
OTP_REQUEST_WINDOW_SEC = 5 * 60
OTP_REQUEST_LOCK_SEC = 15 * 60

E164_REGEX = re.compile(r"^\+[0-9]{10,15}$")


def hash_code(salt: str, code: str) -> str:
    return hashlib.sha256(f"{salt}:{code}".encode("utf-8")).hexdigest()


def generate_otp_code() -> str:
    return f"{secrets.randbelow(10**5):05d}"


def create_otp_for_user(user: Usuario, channel: str) -> tuple[PasswordResetOTP, str]:
    code = generate_otp_code()
    salt = secrets.token_hex(16)
    otp = PasswordResetOTP.objects.create(
        user=user,
        salt=salt,
        code_hash=hash_code(salt, code),
        expires_at=timezone.now() + timedelta(minutes=OTP_TTL_MINUTES),
        channel=channel,
    )
    return otp, code


def send_password_reset_email(to_email: str, code: str):
    subject = "SADI - Codigo de recuperacion"
    context = {"otp": code, "ttl_minutes": OTP_TTL_MINUTES, "email": to_email}

    text_body = (
        f"Tu codigo de recuperacion SADI es: {code}\n\n"
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


def normalize_phone_e164(phone: str) -> str:
    raw = (phone or "").strip()
    raw = raw.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if raw.startswith("00"):
        raw = f"+{raw[2:]}"
    # Soporte UX Colombia: 10 digitos => +57XXXXXXXXXX
    only_digits = re.sub(r"[^\d]", "", raw)
    if not raw.startswith("+") and len(only_digits) == 10:
        raw = f"+57{only_digits}"
    if not raw.startswith("+"):
        raise ValueError("El telefono debe estar en formato internacional E.164, por ejemplo +573001112233.")
    if not E164_REGEX.match(raw):
        raise ValueError("Telefono invalido para WhatsApp.")
    return raw


def send_password_reset_whatsapp(phone: str, code: str):
    provider = (getattr(settings, "WHATSAPP_PROVIDER", "") or "").strip().lower()
    if not provider:
        raise RuntimeError("WHATSAPP_PROVIDER no configurado.")

    normalized_to = normalize_phone_e164(phone)
    to = f"whatsapp:{normalized_to}"

    if provider == "console":
        print(f"[SADI][WHATSAPP] OTP para {to}: {code}")
        return

    if provider != "twilio":
        raise RuntimeError("Proveedor de WhatsApp no soportado.")

    account_sid = (getattr(settings, "TWILIO_ACCOUNT_SID", "") or "").strip()
    auth_token = (getattr(settings, "TWILIO_AUTH_TOKEN", "") or "").strip()
    from_number = (getattr(settings, "TWILIO_WHATSAPP_NUMBER", "") or "").strip()
    if not account_sid or not auth_token or not from_number:
        raise RuntimeError("Faltan credenciales de Twilio para WhatsApp.")

    if not from_number.startswith("whatsapp:"):
        from_number = f"whatsapp:{from_number}"

    try:
        from twilio.rest import Client
    except Exception as exc:
        raise RuntimeError("Paquete twilio no instalado.") from exc

    message_body = (
        f"Tu codigo OTP de SADI es {code}. "
        f"Vence en {OTP_TTL_MINUTES} minutos. "
        "Si no solicitaste este cambio, ignora este mensaje."
    )

    client = Client(account_sid, auth_token)
    client.messages.create(body=message_body, from_=from_number, to=to)


def send_otp(channel: str, user: Usuario, code: str):
    if channel == PasswordResetOTP.Channel.EMAIL:
        send_password_reset_email(user.email, code)
        return
    if channel == PasswordResetOTP.Channel.WHATSAPP:
        send_password_reset_whatsapp(user.telefono or "", code)
        return
    raise ValueError("Canal OTP no soportado.")
