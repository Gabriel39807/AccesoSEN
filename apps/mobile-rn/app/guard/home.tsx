import React, { useEffect, useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSessionStore } from "../../src/store/session";
import { api } from "../../src/api/client";
import * as Accesos from "../../src/api/accesos";
import { GuardBottomNav } from "../../src/ui/guard-bottom-nav";
import { EmptyState, FadeInCard, ModernButton, ModernScreen, NoticeBanner, Pill, SkeletonCard, TitleBlock, uiTheme } from "../../src/ui/modern";

type AccesoRow = { id: number; tipo: "ingreso" | "salida"; fecha: string };

export default function GuardHome() {
  const user = useSessionStore((s) => s.user);
  const turno = useSessionStore((s) => s.turno);
  const signOut = useSessionStore((s) => s.signOut);

  const [loading, setLoading] = useState(true);
  const [recientes, setRecientes] = useState<AccesoRow[]>([]);
  const [stats, setStats] = useState<{ ingresos: number; salidas: number; total: number } | null>(null);

  async function cargarRecientes() {
    setLoading(true);
    try {
      const r = await api.get("/api/accesos/?page=1");
      const results = r.data?.results ?? [];
      setRecientes(results.slice(0, 8));
    } catch {
      setRecientes([]);
    } finally {
      setLoading(false);
    }
  }

  async function cargarStats() {
    try {
      const r = await Accesos.stats();
      if (r?.permitido && r.stats) setStats(r.stats);
      else setStats(null);
    } catch {
      setStats(null);
    }
  }

  useEffect(() => {
    void cargarRecientes();
    void cargarStats();
  }, []);

  const statCards = [
    { label: "Ingresos", value: stats?.ingresos ?? "-", tone: "rgba(15,118,110,0.08)", border: "rgba(15,118,110,0.14)", fg: uiTheme.accentDeep },
    { label: "Salidas", value: stats?.salidas ?? "-", tone: "rgba(161,98,7,0.08)", border: "rgba(161,98,7,0.16)", fg: uiTheme.warn },
    { label: "Total", value: stats?.total ?? "-", tone: "rgba(15,23,42,0.92)", border: "rgba(15,23,42,0.16)", fg: "#ffffff" },
  ];

  const operationalSignals = [
    { label: "Turno", value: turno?.jornada ?? "-", icon: "time-outline" as const },
    { label: "Sede", value: turno?.sede ?? "-", icon: "business-outline" as const },
    { label: "Estado", value: "Activo", icon: "pulse-outline" as const },
  ];

  return (
    <ModernScreen scroll bottomAccessory={<GuardBottomNav />}>
      <FadeInCard delay={0} style={{ gap: 16 }}>
        <Pill text="GUARDA ACTIVO" />
        <TitleBlock
          title={`Hola, ${user?.first_name || user?.username || "Guarda"}`}
          subtitle={`Sede ${turno?.sede ?? "-"} | Turno ${turno?.jornada ?? "-"}`}
        />

        <View
          style={{
            borderRadius: 24,
            padding: 16,
            backgroundColor: "rgba(15,23,42,0.92)",
            borderWidth: 1,
            borderColor: "rgba(15,23,42,0.18)",
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={{ color: "rgba(255,255,255,0.62)", fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
                Centro operativo
              </Text>
              <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: "900" }}>Control de acceso en tiempo real</Text>
              <Text style={{ color: "rgba(255,255,255,0.76)", lineHeight: 20 }}>
                Revisa el volumen de movimientos, valida ingresos con rapidez y mantén la jornada bajo una sola vista operativa.
              </Text>
            </View>
            <View style={{ width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
              <Ionicons name="shield-checkmark-outline" size={23} color="#ffffff" />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {operationalSignals.map((item) => (
              <View key={item.label} style={{ flex: 1, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", gap: 8 }}>
                <Ionicons name={item.icon} size={16} color="rgba(255,255,255,0.86)" />
                <Text style={{ color: "rgba(255,255,255,0.58)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>{item.label}</Text>
                <Text style={{ color: "#ffffff", fontWeight: "900" }}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={70} style={{ gap: 10 }}>
        <Text style={{ color: uiTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
          Resumen del turno
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {statCards.map((item) => (
            <View
              key={item.label}
              style={{
                flex: 1,
                borderRadius: 22,
                padding: 14,
                backgroundColor: item.tone,
                borderWidth: 1,
                borderColor: item.border,
              }}
            >
              <Text style={{ color: item.fg === "#ffffff" ? "rgba(255,255,255,0.66)" : uiTheme.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
                {item.label}
              </Text>
              <Text style={{ color: item.fg, fontSize: 28, fontWeight: "900", marginTop: 8 }}>{item.value}</Text>
            </View>
          ))}
        </View>
        <NoticeBanner tone="info" text="El escáner central es la vía más rápida para validar accesos y mantener el flujo sin fricciones en portería." />
      </FadeInCard>

      <FadeInCard delay={120} style={{ gap: 10 }}>
        <Text style={{ color: uiTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
          Acciones clave
        </Text>
        <ModernButton label="Escanear QR / Barras" icon="scan-outline" onPress={() => router.push("/guard/scan" as any)} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <ModernButton label="Historial" icon="time-outline" tone="light" onPress={() => router.push("/guard/historial" as any)} />
          </View>
          <View style={{ flex: 1 }}>
            <ModernButton label="Alertas" icon="notifications-outline" tone="light" onPress={() => router.push("/guard/alertas" as any)} />
          </View>
        </View>
        <ModernButton
          label="Cerrar turno"
          icon="flag-outline"
          tone="danger"
          onPress={() => {
            if (!turno?.id) {
              Alert.alert("Sin turno", "No hay turno activo para cerrar.");
              return;
            }
            router.push({ pathname: "/guard/cierre-turno", params: { id: String(turno.id) } } as any);
          }}
        />
        <ModernButton
          label="Cerrar sesión"
          icon="log-out-outline"
          tone="dark"
          onPress={async () => {
            await signOut();
            router.replace("/" as any);
          }}
        />
      </FadeInCard>

      <FadeInCard delay={160} style={{ gap: 12 }}>
        <Text style={{ color: uiTheme.ink, fontSize: 18, fontWeight: "900" }}>Registros recientes</Text>
        {loading ? (
          <View style={{ gap: 10 }}>
            <SkeletonCard rows={2} />
            <SkeletonCard rows={2} />
          </View>
        ) : (
          <FlatList
            data={recientes}
            scrollEnabled={false}
            keyExtractor={(i) => String(i.id)}
            renderItem={({ item }) => {
              const accentColor = item.tipo === "ingreso" ? uiTheme.success : uiTheme.warn;
              return (
                <View
                  style={{
                    backgroundColor: "rgba(255,255,255,0.78)",
                    borderWidth: 1,
                    borderColor: "rgba(148,163,184,0.22)",
                    borderRadius: 20,
                    padding: 14,
                    marginBottom: 10,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontWeight: "900", color: uiTheme.ink }}>#{item.id}</Text>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: `${accentColor}18`, borderWidth: 1, borderColor: `${accentColor}26` }}>
                      <Text style={{ color: accentColor, fontWeight: "900", fontSize: 11, letterSpacing: 0.8 }}>{item.tipo.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={{ color: uiTheme.inkSoft }}>{new Date(item.fecha).toLocaleString()}</Text>
                </View>
              );
            }}
            ListEmptyComponent={
              <EmptyState
                icon="reader-outline"
                title="Sin movimientos recientes"
                subtitle="Los últimos ingresos y salidas validados durante el turno aparecerán aquí."
              />
            }
          />
        )}
      </FadeInCard>
    </ModernScreen>
  );
}
