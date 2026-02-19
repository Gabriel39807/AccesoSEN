from django.apps import AppConfig
from django.db.models.signals import post_migrate


class AccesosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accesos'

    def ready(self):
        post_migrate.connect(ensure_superadmin_exists, sender=self)


def ensure_superadmin_exists(sender, **kwargs):
    from django.contrib.auth import get_user_model
    from django.conf import settings

    if not getattr(settings, "DEFAULT_SUPERADMIN_AUTO_CREATE", True):
        return

    User = get_user_model()
    if User.objects.filter(rol="superadmin").exists():
        return

    legacy_admin = User.objects.filter(rol="admin").order_by("id").first()
    if legacy_admin:
        legacy_admin.rol = "superadmin"
        legacy_admin.is_staff = True
        legacy_admin.is_superuser = True
        legacy_admin.save(update_fields=["rol", "is_staff", "is_superuser"])
        return

    username = getattr(settings, "DEFAULT_SUPERADMIN_USERNAME", "superadmin")
    email = getattr(settings, "DEFAULT_SUPERADMIN_EMAIL", "superadmin@sadi.local")
    password = getattr(settings, "DEFAULT_SUPERADMIN_PASSWORD", "Superadmin123!")
    user = User.objects.filter(username=username).first()
    if user:
        user.rol = "superadmin"
        user.is_staff = True
        user.is_superuser = True
        user.email = user.email or email
        user.save(update_fields=["rol", "is_staff", "is_superuser", "email"])
        return

    User.objects.create_superuser(
        username=username,
        email=email,
        password=password,
        rol="superadmin",
    )
