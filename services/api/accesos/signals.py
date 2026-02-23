"""Model signals for runtime consistency."""

from __future__ import annotations

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from accesos.models import Role, UserMembership, Usuario


def _role_name(role_code: str) -> str:
    mapping = {
        "superadmin": "Superadmin",
        "admin_sede": "Admin de sede",
        "guarda": "Guarda",
        "aprendiz": "Aprendiz",
    }
    return mapping.get(role_code, role_code.replace("_", " ").title())


@receiver(post_save, sender=Usuario)
def sync_user_primary_membership(sender, instance: Usuario, **kwargs):
    """Keep primary membership aligned after user writes.

    This preserves backwards compatibility for flows that still create users
    through legacy fields while keeping authorization runtime data-driven.
    """
    created = bool(kwargs.get("created", False))
    update_fields = kwargs.get("update_fields")
    if not created and update_fields is not None:
        normalized_fields = {str(field) for field in update_fields}
        if normalized_fields.isdisjoint({"rol", "sede_principal", "sede_principal_id"}):
            return

    role_code = str(getattr(instance, "rol", "") or "").strip().lower()
    if role_code == "admin":
        role_code = "admin_sede"
    if not role_code:
        return

    target_sede = None if role_code == Usuario.Rol.SUPERADMIN else getattr(instance, "sede_principal", None)
    role_obj, _ = Role.objects.get_or_create(
        code=role_code,
        defaults={"name": _role_name(role_code), "is_system": True},
    )

    with transaction.atomic():
        UserMembership.objects.filter(user=instance, is_primary=True).update(is_primary=False)
        membership, created = UserMembership.objects.get_or_create(
            user=instance,
            role=role_obj,
            sede=target_sede,
            defaults={
                "is_primary": True,
                "is_active": True,
                "can_switch_sede": role_code == Usuario.Rol.SUPERADMIN,
            },
        )
        if created:
            return

        update_fields: list[str] = []
        if not membership.is_primary:
            membership.is_primary = True
            update_fields.append("is_primary")
        if not membership.is_active:
            membership.is_active = True
            update_fields.append("is_active")
        if role_code == Usuario.Rol.SUPERADMIN and not membership.can_switch_sede:
            membership.can_switch_sede = True
            update_fields.append("can_switch_sede")
        if update_fields:
            membership.save(update_fields=update_fields)
