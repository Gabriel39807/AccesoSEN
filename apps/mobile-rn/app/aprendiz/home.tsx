import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router } from "expo-router";

import { api } from "../../src/api/client";
import { useSessionStore } from "../../src/store/session";
import { FadeInCard, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

type EstadoResponse = {
  permitido: boolean;
  motivo: string | null;
  estado?: "dentro" | "fuera";
};

export default function AprendizHome() {
  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);
  const [estado, setEstado] = useState<"dentro" | "fuera" | null>(null);
  const [loading, setLoading] = useState(true);

  async function cargarEstado() {
    setLoading(true);
    try {
      const r = await api.get<EstadoResponse>("/api/accesos/estado/");
      setEstado(r.data?.estado ?? null);
    } catch {
      setEstado(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarEstado();
  }, []);

  return (
    <ModernScreen scroll>
      <FadeInCard delay={0}>
        <Pill text="PANEL APRENDIZ" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock
            title={`Hola, ${user?.first_name || user?.username || "Aprendiz"}`}
            subtitle={`Documento ${user?.documento || "-"} | Programa ${user?.programa_formacion || "-"}`}
          />
        </View>
      </FadeInCard>

      <FadeInCard delay={70}>
        <Text style={{ color: "#64748b" }}>Estado actual</Text>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 8 }} />
        ) : (
          <Text
            style={{
              marginTop: 6,
              fontWeight: "900",
              fontSize: 22,
              color: estado === "dentro" ? "#15803d" : "#a16207",
            }}
          >
            {estado ? estado.toUpperCase() : "NO DISPONIBLE"}
          </Text>
        )}
      </FadeInCard>

      <FadeInCard delay={120}>
        <View style={{ gap: 8 }}>
          <ModernButton label="Historial" tone="dark" onPress={() => router.push("/aprendiz/historial" as any)} />
          <ModernButton label="Mis Equipos" onPress={() => router.push("/aprendiz/equipos" as any)} />
          <ModernButton label="Mi QR" tone="light" onPress={() => router.push("/aprendiz/mi-qr" as any)} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ModernButton label="Perfil" tone="light" onPress={() => router.push("/aprendiz/perfil" as any)} />
            </View>
            <View style={{ flex: 1 }}>
              <ModernButton label="Ayuda" tone="light" onPress={() => router.push("/aprendiz/ayuda" as any)} />
            </View>
          </View>
          <ModernButton
            label="Cerrar sesion"
            tone="dark"
            onPress={async () => {
              await signOut();
              router.replace("/" as any);
            }}
          />
        </View>
      </FadeInCard>
    </ModernScreen>
  );
}
