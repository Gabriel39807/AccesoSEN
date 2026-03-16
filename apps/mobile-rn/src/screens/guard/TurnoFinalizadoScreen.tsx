import React from "react";

import { useSystemBranding } from "../../theme/system-branding";
import { FadeInCard, ModernButton, ModernScreen, Pill, TitleBlock } from "../../ui/modern";
import { useSessionStore } from "../../store/session";

export function TurnoFinalizadoScreen() {
  const signOut = useSessionStore((state) => state.signOut);
  const { config } = useSystemBranding();

  return (
    <ModernScreen contentStyle={{ justifyContent: "center" }}>
      <FadeInCard style={{ gap: 18 }}>
        <Pill text="TURNO CERRADO" />
        <TitleBlock
          title="Turno finalizado"
          subtitle={`${config.nombre_institucion || "La institución"} registró correctamente el cierre de tu jornada.`}
        />
        <TitleBlock
          title="Todo quedó auditado"
          subtitle="Gracias por tu labor en el control de acceso. Puedes cerrar sesión de forma segura."
        />
        <ModernButton onPress={signOut} label="Cerrar sesión" icon="log-out-outline" />
      </FadeInCard>
    </ModernScreen>
  );
}
