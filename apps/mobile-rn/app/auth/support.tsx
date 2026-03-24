import React from "react";
import { Linking, Text, View } from "react-native";
import { router } from "expo-router";

import { FadeInCard, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

export default function AuthSupportScreen() {
  function onBack() {
    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/auth/login?rol=guarda" as any);
  }

  return (
    <ModernScreen scroll theme="guard">
      <FadeInCard>
        <Pill text="SOPORTE" tone="guard" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock title="Soporte" subtitle="Si tienes problemas para ingresar o necesitas ayuda con tu cuenta, aquí tienes los canales de atención." />
        </View>
      </FadeInCard>

      <FadeInCard delay={70}>
        <View style={{ gap: 12 }}>
          <Text style={{ color: "#475569", lineHeight: 22 }}>
            Usa recuperación de contraseña solo cuando olvidaste tu clave. Si el problema es de acceso, sede, turno o validación de usuario, comunícate con soporte o administración.
          </Text>
          <Text style={{ color: "#0f172a", fontWeight: "800" }}>Canales de ayuda</Text>
          <Text style={{ color: "#475569" }}>Correo: soporte@institucion.local</Text>
          <Text style={{ color: "#475569" }}>Teléfono: +57 300 000 0000</Text>
          <Text style={{ color: "#475569" }}>Horario: lunes a viernes, 7:00 a.m. a 5:00 p.m.</Text>
        </View>
      </FadeInCard>

      <FadeInCard delay={120}>
        <View style={{ gap: 12 }}>
          <ModernButton label="Escribir a soporte" tone="guard" onPress={() => Linking.openURL("mailto:soporte@institucion.local")} />
          <ModernButton label="Llamar a soporte" tone="light" onPress={() => Linking.openURL("tel:+573000000000")} />
          <ModernButton label="Recuperar contraseña" tone="light" onPress={() => router.push("/auth/password-recovery" as any)} />
          <ModernButton label="Volver al login" tone="dark" onPress={onBack} />
        </View>
      </FadeInCard>
    </ModernScreen>
  );
}
