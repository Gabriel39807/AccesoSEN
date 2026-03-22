"""Model signals for transitional legacy-to-membership synchronization."""

from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from accesos.models import Usuario, canonical_role_code, sync_primary_membership


@receiver(post_save, sender=Usuario)
def sync_user_primary_membership(sender, instance: Usuario, **kwargs):
    """Keep memberships aligned only for explicit legacy compatibility writes.

    This preserves backwards compatibility for flows that still create users
    through legacy fields while keeping authorization runtime data-driven.
    It is intentionally narrow: runtime authorization must only read
    memberships, not infer permissions from legacy `Usuario.rol` or
    `Usuario.sede_principal`.
    """
    created = bool(kwargs.get("created", False))
    update_fields = kwargs.get("update_fields")
    if not created:
        normalized_fields = {str(field) for field in (update_fields or set())}
        if normalized_fields.isdisjoint({"rol", "sede_principal", "sede_principal_id"}):
            return

    role_code = canonical_role_code(getattr(instance, "rol", ""))
    if not role_code:
        return

    target_sede = None if role_code == Usuario.Rol.SUPERADMIN else getattr(instance, "sede_principal", None)
    sync_primary_membership(
        user=instance,
        role_code=role_code,
        sede=target_sede,
        is_active=True,
        can_switch_sede=role_code == Usuario.Rol.SUPERADMIN,
    )
