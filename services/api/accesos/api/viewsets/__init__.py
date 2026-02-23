from .accesos import AccesoViewSet
from .allowed_email_domains import AllowedEmailDomainViewSet
from .equipos import EquipoViewSet
from .notificaciones import NotificacionViewSet
from .permissions import PermissionViewSet
from .role_permissions import RolePermissionViewSet
from .roles import RoleViewSet
from .sedes import SedeViewSet
from .sede_policies import SedePolicyViewSet
from .turnos import TurnoViewSet
from .usuarios import UsuarioViewSet

__all__ = [
    "AccesoViewSet",
    "AllowedEmailDomainViewSet",
    "EquipoViewSet",
    "NotificacionViewSet",
    "PermissionViewSet",
    "RolePermissionViewSet",
    "RoleViewSet",
    "SedeViewSet",
    "SedePolicyViewSet",
    "TurnoViewSet",
    "UsuarioViewSet",
]
