import React from "react";
import { Linking, Text, View } from "react-native";
import { FadeInCard, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

export default function AprendizAyuda() {
  return (
    <ModernScreen scroll>
      <FadeInCard>
        <Pill text="AYUDA Y SOPORTE" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock title="Te ayudamos" subtitle="Resuelve dudas sobre accesos, equipos y credenciales." />
        </View>
      </FadeInCard>

      <FadeInCard delay={70}>
        <Text style={{ color: "#0f172a", fontWeight: "800" }}>Preguntas frecuentes</Text>
        <Text style={{ color: "#475569", marginTop: 8 }}>- Registra tus equipos antes de llegar al control de acceso.</Text>
        <Text style={{ color: "#475569" }}>- Si olvidaste tu clave, usa la recuperacion OTP.</Text>
        <Text style={{ color: "#475569" }}>- Verifica siempre que el serial del equipo sea correcto.</Text>
      </FadeInCard>

      <FadeInCard delay={120}>
        <ModernButton
          label="Correo soporte@institucion.local"
          tone="dark"
          onPress={() => Linking.openURL("mailto:soporte@institucion.local")}
        />
      </FadeInCard>
    </ModernScreen>
  );
}
