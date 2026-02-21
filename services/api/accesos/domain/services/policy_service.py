from __future__ import annotations

from dataclasses import dataclass

from accesos.models import Sede, SedePolicy


@dataclass(frozen=True)
class PolicySnapshot:
    max_equipos_aprendiz: int = 4
    guards_can_switch_sede: bool = False
    qr_mode: str = SedePolicy.QrMode.DUAL
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
            max_equipos_aprendiz=max(1, int(policy.max_equipos_aprendiz or 4)),
            guards_can_switch_sede=bool(policy.guards_can_switch_sede),
            qr_mode=policy.qr_mode or SedePolicy.QrMode.DUAL,
            require_equipo_approval=bool(policy.require_equipo_approval),
            access_requires_active_turno=bool(policy.access_requires_active_turno),
        )

