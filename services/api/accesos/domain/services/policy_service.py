from __future__ import annotations

from dataclasses import dataclass

from django.conf import settings

from accesos.models import Sede, SedePolicy


CANONICAL_MAX_EQUIPOS_APRENDIZ = 4


def _is_production() -> bool:
    return str(getattr(settings, "CURRENT_DJANGO_ENV", "development") or "").strip().lower() == "production"


def _effective_qr_mode(raw_mode: str | None) -> str:
    normalized = str(raw_mode or SedePolicy.QrMode.SIGNED).strip().upper()
    allowed = {choice for choice, _ in SedePolicy.QrMode.choices}
    if normalized not in allowed:
        normalized = SedePolicy.QrMode.SIGNED
    if _is_production():
        return SedePolicy.QrMode.SIGNED
    return normalized


@dataclass(frozen=True)
class PolicySnapshot:
    max_equipos_aprendiz: int = CANONICAL_MAX_EQUIPOS_APRENDIZ
    guards_can_switch_sede: bool = False
    qr_mode: str = SedePolicy.QrMode.SIGNED
    require_equipo_approval: bool = True
    access_requires_active_turno: bool = True


class PolicyService:
    @classmethod
    def get_policy(cls, sede: Sede | None) -> PolicySnapshot:
        if not sede:
            return PolicySnapshot()

        policy = SedePolicy.objects.filter(sede=sede).first()
        if not policy:
            return PolicySnapshot()
        return PolicySnapshot(
            max_equipos_aprendiz=CANONICAL_MAX_EQUIPOS_APRENDIZ,
            guards_can_switch_sede=bool(policy.guards_can_switch_sede),
            qr_mode=_effective_qr_mode(policy.qr_mode),
            require_equipo_approval=bool(policy.require_equipo_approval),
            access_requires_active_turno=True,
        )
