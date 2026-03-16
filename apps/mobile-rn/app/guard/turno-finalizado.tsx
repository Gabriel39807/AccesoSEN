import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useSessionStore } from "../../src/store/session";
import { FadeInCard, ModernButton, ModernScreen, NoticeBanner, Pill, uiTheme } from "../../src/ui/modern";

const completionPoints = [
  "Resumen del turno consolidado correctamente.",
  "No quedan validaciones pendientes en esta sesión.",
  "Ya puedes salir del módulo operativo con seguridad.",
];

export default function TurnoFinalizado() {
  const signOut = useSessionStore((s) => s.signOut);

  return (
    <ModernScreen contentStyle={{ justifyContent: "center" }}>
      <FadeInCard delay={0} style={{ gap: 16 }}>
        <Pill text="TURNO FINALIZADO" />
        <View
          style={{
            borderRadius: 30,
            backgroundColor: "rgba(15,118,110,0.1)",
            borderWidth: 1,
            borderColor: "rgba(15,118,110,0.16)",
            padding: 18,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={{ color: uiTheme.accentDeep, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
                Operación completada
              </Text>
              <Text style={{ color: uiTheme.ink, fontSize: 28, lineHeight: 32, fontWeight: "900", letterSpacing: -0.8 }}>
                El turno quedó cerrado y listo para relevo
              </Text>
              <Text style={{ color: uiTheme.inkSoft, lineHeight: 20 }}>
                El sistema confirmó tu salida operativa y dejó la jornada lista para continuar con el siguiente control.
              </Text>
            </View>
            <View style={{ width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.62)", borderWidth: 1, borderColor: "rgba(15,118,110,0.12)" }}>
              <Ionicons name="checkmark-done-outline" size={26} color={uiTheme.accentDeep} />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.62)" }}>
              <Text style={{ color: uiTheme.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>Estado</Text>
              <Text style={{ color: uiTheme.ink, fontWeight: "900", marginTop: 6 }}>Jornada cerrada</Text>
            </View>
            <View style={{ flex: 1, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.62)" }}>
              <Text style={{ color: uiTheme.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>Recomendado</Text>
              <Text style={{ color: uiTheme.ink, fontWeight: "900", marginTop: 6 }}>Salir del módulo</Text>
            </View>
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={70} style={{ gap: 12 }}>
        <Text style={{ color: uiTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
          Cierre verificado
        </Text>
        {completionPoints.map((point) => (
          <View key={point} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(148,163,184,0.18)" }}>
            <View style={{ marginTop: 1 }}>
              <Ionicons name="checkmark-circle-outline" size={18} color={uiTheme.success} />
            </View>
            <Text style={{ color: uiTheme.inkSoft, flex: 1, lineHeight: 20 }}>{point}</Text>
          </View>
        ))}
        <NoticeBanner tone="success" text="Si ya terminaste la jornada, lo más seguro es cerrar sesión para evitar accesos involuntarios desde este dispositivo." />
      </FadeInCard>

      <FadeInCard delay={120} style={{ gap: 10 }}>
        <ModernButton
          label="Cerrar sesión y salir"
          icon="log-out-outline"
          onPress={async () => {
            await signOut();
            router.replace("/");
          }}
        />
        <ModernButton label="Volver al dashboard" icon="grid-outline" tone="light" onPress={() => router.replace("/guard/home" as any)} />
      </FadeInCard>
    </ModernScreen>
  );
}
