"""AppConfig for `accesos` and controlled superadmin bootstrap.

Responsibility:
- Register post-migrate hooks.
- Ensure an initial superadmin exists when policy enables it.
"""

from django.apps import AppConfig
from django.db.models.signals import post_migrate


class AccesosConfig(AppConfig):
    """Main configuration for the `accesos` app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accesos'

    def ready(self):
        """Attach post_migrate signal for admin bootstrap."""
        # Register model signals (membership sync, etc.)
        from . import signals  # noqa: F401

        post_migrate.connect(ensure_superadmin_exists, sender=self)


def ensure_superadmin_exists(sender, **kwargs):
    """Ensure a consistent superadmin without hardcoded credentials.

    Auto-creation only runs when `DEFAULT_SUPERADMIN_AUTO_CREATE` is enabled
    and `DEFAULT_SUPERADMIN_PASSWORD` exists in environment settings.
    """
    from django.contrib.auth import get_user_model
    from django.conf import settings
    from accesos.models import Role, UserMembership

    def sync_superadmin_membership(user):
        """Sync primary GLOBAL membership for superadmin role."""
        role_obj, _ = Role.objects.get_or_create(
            code="superadmin",
            defaults={"name": "Superadmin", "is_system": True},
        )
        membership, _ = UserMembership.objects.get_or_create(
            user=user,
            role=role_obj,
            sede=None,
            defaults={
                "is_primary": True,
                "is_active": True,
                "can_switch_sede": True,
            },
        )
        updates = []
        if not membership.is_primary:
            membership.is_primary = True
            updates.append("is_primary")
        if not membership.is_active:
            membership.is_active = True
            updates.append("is_active")
        if not membership.can_switch_sede:
            membership.can_switch_sede = True
            updates.append("can_switch_sede")
        if updates:
            membership.save(update_fields=updates)
        UserMembership.objects.filter(user=user).exclude(id=membership.id).update(is_primary=False)

    if not getattr(settings, "DEFAULT_SUPERADMIN_AUTO_CREATE", True):
        return

    User = get_user_model()
    if User.objects.filter(rol="superadmin").exists():
        user = User.objects.filter(rol="superadmin").order_by("id").first()
        if user:
            sync_superadmin_membership(user)
        return

    legacy_admin = User.objects.filter(rol="admin").order_by("id").first()
    if legacy_admin:
        legacy_admin.rol = "superadmin"
        legacy_admin.is_staff = True
        legacy_admin.is_superuser = True
        legacy_admin.save(update_fields=["rol", "is_staff", "is_superuser"])
        sync_superadmin_membership(legacy_admin)
        return

    username = getattr(settings, "DEFAULT_SUPERADMIN_USERNAME", "superadmin")
    email = getattr(settings, "DEFAULT_SUPERADMIN_EMAIL", "superadmin@sadi.local")
    password = str(getattr(settings, "DEFAULT_SUPERADMIN_PASSWORD", "") or "").strip()
    if not password:
        # Skip bootstrap when password is missing in environment.
        return
    user = User.objects.filter(username=username).first()
    if user:
        user.rol = "superadmin"
        user.is_staff = True
        user.is_superuser = True
        user.email = user.email or email
        user.save(update_fields=["rol", "is_staff", "is_superuser", "email"])
        sync_superadmin_membership(user)
        return

    created = User.objects.create_superuser(
        username=username,
        email=email,
        password=password,
        rol="superadmin",
    )
    sync_superadmin_membership(created)
