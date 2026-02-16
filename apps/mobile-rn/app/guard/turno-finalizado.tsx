import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useSessionStore } from "../../src/store/session";
import { FadeInCard, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

export default function TurnoFinalizado() {
  const signOut = useSessionStore((s) => s.signOut);

  return (
    <ModernScreen contentStyle={{ justifyContent: "center" }}>
      <FadeInCard>
        <Pill text="TURNO FINALIZADO" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock
            title="Cierre exitoso"
            subtitle="Tu turno se cerro correctamente. Gracias por tu labor en el control de acceso."
          />
        </View>
        <View style={{ marginTop: 14 }}>
          <ModernButton
            label="Volver al inicio"
            onPress={async () => {
              await signOut();
              router.replace("/");
            }}
          />
        </View>
      </FadeInCard>
    </ModernScreen>
  );
}
