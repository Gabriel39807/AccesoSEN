import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { FadeInCard, ModernButton, ModernScreen, Pill, TitleBlock } from "../src/ui/modern";

export default function ModalScreen() {
  return (
    <ModernScreen contentStyle={{ justifyContent: "center" }}>
      <FadeInCard delay={0} style={{ gap: 16 }}>
        <Pill text="ACCESO RAPIDO" />
        <View
          style={{
            borderRadius: 30,
            backgroundColor: "rgba(15,23,42,0.92)",
            borderWidth: 1,
            borderColor: "rgba(15,23,42,0.16)",
            padding: 18,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={{ color: "rgba(255,255,255,0.62)", fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
                Modal del sistema
              </Text>
              <Text style={{ color: "#ffffff", fontSize: 28, lineHeight: 32, fontWeight: "900", letterSpacing: -0.8 }}>
                Panel rapido SADI
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.76)", lineHeight: 20 }}>
                Este espacio puede usarse para accesos rapidos, avisos o acciones contextuales dentro de la app movil.
              </Text>
            </View>
            <View style={{ width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
              <Ionicons name="apps-outline" size={24} color="#ffffff" />
            </View>
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={70} style={{ gap: 10 }}>
        <View style={{ borderRadius: 20, padding: 14, backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(148,163,184,0.22)" }}>
          <TitleBlock title="Vista temporal" subtitle="La plantilla base fue reemplazada por una presentacion coherente con el lenguaje visual del proyecto." />
        </View>
        <ModernButton label="Volver al inicio" tone="dark" onPress={() => router.replace("/" as any)} />
        <ModernButton label="Cerrar" tone="light" onPress={() => router.back()} />
      </FadeInCard>
    </ModernScreen>
  );
}
