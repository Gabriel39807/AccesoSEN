import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { api } from "../../src/api/client";
import { useSessionStore } from "../../src/store/session";
import { FadeInCard, ModernButton, ModernScreen, NoticeBanner, Pill, SkeletonLine, TitleBlock, uiTheme } from "../../src/ui/modern";

type EstadoResponse = {
  permitido: boolean;
  motivo: string | null;
  estado?: "dentro" | "fuera" | "DENTRO" | "FUERA" | "SIN_REGISTROS" | string;
};

function normalizeEstado(raw?: string | null): "dentro" | "fuera" | "sin_registros" | null {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "DENTRO") return "dentro";
  if (value === "FUERA") return "fuera";
  if (value === "SIN_REGISTROS") return "sin_registros";
  return null;
}

function stateCopy(estado: "dentro" | "fuera" | "sin_registros" | null) {
  if (estado === "dentro") return { label: "Dentro", color: uiTheme.success, note: "Tu último registro indica presencia activa en la sede.", hero: "Acceso activo y trazable" };
  if (estado === "fuera") return { label: "Fuera", color: uiTheme.warn, note: "No hay un ingreso activo en este momento.", hero: "Listo para tu siguiente ingreso" };
  if (estado === "sin_registros") return { label: "Sin registros", color: uiTheme.muted, note: "Aún no hay movimientos recientes asociados a tu perfil.", hero: "Aún no hay trazabilidad reciente" };
  return { label: "No disponible", color: uiTheme.muted, note: "No fue posible consultar el estado actual.", hero: "Estado temporalmente no disponible" };
}

const quickActions = [
  { label: "Historial", tone: "dark" as const, path: "/aprendiz/historial", icon: "time-outline" as const },
  { label: "Mis equipos", tone: "primary" as const, path: "/aprendiz/equipos", icon: "hardware-chip-outline" as const },
  { label: "Mi QR", tone: "light" as const, path: "/aprendiz/mi-qr", icon: "qr-code-outline" as const },
  { label: "Perfil", tone: "light" as const, path: "/aprendiz/perfil", icon: "person-outline" as const },
  { label: "Ayuda", tone: "light" as const, path: "/aprendiz/ayuda", icon: "help-circle-outline" as const },
];

export default function AprendizHome() {
  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);
  const [estado, setEstado] = useState<"dentro" | "fuera" | "sin_registros" | null>(null);
  const [loading, setLoading] = useState(true);

  async function cargarEstado() {
    setLoading(true);
    try {
      const r = await api.get<EstadoResponse>("/api/accesos/estado/");
      setEstado(normalizeEstado(r.data?.estado));
    } catch {
      setEstado(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargarEstado();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void cargarEstado();
      return undefined;
    }, [])
  );

  const currentState = stateCopy(estado);

  return (
    <ModernScreen scroll>
      <FadeInCard delay={0} style={{ gap: 16 }}>
        <Pill text="PANEL APRENDIZ" />
        <TitleBlock
          title={`Hola, ${user?.first_name || user?.username || "Aprendiz"}`}
          subtitle={`Documento ${user?.documento || "-"} | Programa ${user?.programa_formacion || "-"}`}
        />

        <View
          style={{
            borderRadius: 28,
            padding: 18,
            backgroundColor: "rgba(15,118,110,0.08)",
            borderWidth: 1,
            borderColor: "rgba(15,118,110,0.14)",
            gap: 12,
          }}
        >
          <Text style={{ color: uiTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
            Estado de acceso
          </Text>
          {loading ? (
            <View style={{ gap: 10, marginTop: 4 }}>
              <SkeletonLine width="46%" height={24} />
              <SkeletonLine width="82%" height={16} />
              <SkeletonLine width="60%" height={16} />
            </View>
          ) : (
            <>
              <Text style={{ color: uiTheme.ink, fontSize: 26, lineHeight: 30, fontWeight: "900", letterSpacing: -0.7 }}>
                {currentState.hero}
              </Text>
              <View style={{ alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: `${currentState.color}14`, borderWidth: 1, borderColor: `${currentState.color}20` }}>
                <Text style={{ color: currentState.color, fontSize: 12, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>
                  {currentState.label}
                </Text>
              </View>
              <Text style={{ color: uiTheme.inkSoft, lineHeight: 20 }}>{currentState.note}</Text>
            </>
          )}
        </View>
      </FadeInCard>

      <FadeInCard delay={70} style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, borderRadius: 22, padding: 14, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", gap: 8 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,118,110,0.08)" }}>
              <Ionicons name="hardware-chip-outline" size={18} color={uiTheme.accentDeep} />
            </View>
            <Text style={{ color: uiTheme.ink, fontWeight: "900", fontSize: 22 }}>4</Text>
            <Text style={{ color: uiTheme.inkSoft, lineHeight: 18 }}>Equipos máximos que puedes administrar desde tu perfil.</Text>
          </View>
          <View style={{ flex: 1, borderRadius: 22, padding: 14, backgroundColor: "rgba(15,23,42,0.92)", borderWidth: 1, borderColor: "rgba(15,23,42,0.16)", gap: 8 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
              <Ionicons name="qr-code-outline" size={18} color="#ffffff" />
            </View>
            <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: 22 }}>QR</Text>
            <Text style={{ color: "rgba(255,255,255,0.76)", lineHeight: 18 }}>Tu identificación dinámica para control rápido en portería.</Text>
          </View>
        </View>
        <NoticeBanner tone="info" text="Mantener tus equipos y tu QR al día reduce validaciones manuales y hace el ingreso más fluido." />
      </FadeInCard>

      <FadeInCard delay={130} style={{ gap: 12 }}>
        <Text style={{ color: uiTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
          Acciones rápidas
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {quickActions.map((action) => (
            <View key={action.path} style={{ width: "48%" }}>
              <ModernButton label={action.label} tone={action.tone} icon={action.icon} onPress={() => router.push(action.path as any)} />
            </View>
          ))}
          <View style={{ width: "48%" }}>
            <ModernButton
              label="Cerrar sesión"
              tone="dark"
              icon="log-out-outline"
              onPress={async () => {
                await signOut();
                router.replace("/" as any);
              }}
            />
          </View>
        </View>
      </FadeInCard>
    </ModernScreen>
  );
}
