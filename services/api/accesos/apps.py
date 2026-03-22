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
    from accesos.models import UserMembership, sync_primary_membership

    def promote_to_superadmin(user):
        """Bootstrap superadmin canonically, preserving legacy fields only as compat."""
        update_fields: list[str] = []
        if getattr(user, "rol", "") != "superadmin":
            user.rol = "superadmin"
            update_fields.append("rol")
        if not getattr(user, "is_staff", False):
            user.is_staff = True
            update_fields.append("is_staff")
        if not getattr(user, "is_superuser", False):
            user.is_superuser = True
            update_fields.append("is_superuser")
        if update_fields:
            user.save(update_fields=update_fields)
        sync_primary_membership(user=user, role_code="superadmin", sede=None, is_active=True, can_switch_sede=True)

    if not getattr(settings, "DEFAULT_SUPERADMIN_AUTO_CREATE", True):
        return

    User = get_user_model()
    membership = (
        UserMembership.objects.filter(role__code="superadmin", is_active=True)
        .select_related("user")
        .order_by("id")
        .first()
    )
    if membership and membership.user:
        promote_to_superadmin(membership.user)
        return

    user = User.objects.filter(is_superuser=True).order_by("id").first()
    if user:
        promote_to_superadmin(user)
        return

    user = User.objects.filter(rol="superadmin").order_by("id").first()
    if user:
        promote_to_superadmin(user)
        return

    legacy_admin = User.objects.filter(rol__in=["admin", "admin_sede"]).order_by("id").first()
    if legacy_admin:
        promote_to_superadmin(legacy_admin)
        return

    username = getattr(settings, "DEFAULT_SUPERADMIN_USERNAME", "superadmin")
    email = getattr(settings, "DEFAULT_SUPERADMIN_EMAIL", "superadmin@sadi.local")
    password = str(getattr(settings, "DEFAULT_SUPERADMIN_PASSWORD", "") or "").strip()
    if not password:
        # Skip bootstrap when password is missing in environment.
        return
    user = User.objects.filter(username=username).first()
    if user:
        update_fields: list[str] = []
        if not getattr(user, "email", ""):
            user.email = email
            update_fields.append("email")
        if update_fields:
            user.save(update_fields=update_fields)
        promote_to_superadmin(user)
        return

    created = User.objects.create_superuser(
        username=username,
        email=email,
        password=password,
        rol="superadmin",
    )
    promote_to_superadmin(created)
