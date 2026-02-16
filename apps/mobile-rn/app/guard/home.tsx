import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Text, View } from "react-native";
import { router } from "expo-router";

import { useSessionStore } from "../../src/store/session";
import { api } from "../../src/api/client";
import * as Accesos from "../../src/api/accesos";
import { FadeInCard, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

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
    cargarRecientes();
    cargarStats();
  }, []);

  return (
    <ModernScreen scroll>
      <FadeInCard delay={0}>
        <Pill text="GUARDA ACTIVO" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock
            title={`Hola, ${user?.first_name || user?.username || "Guarda"}`}
            subtitle={`Sede ${turno?.sede ?? "-"} | Turno ${turno?.jornada ?? "-"}`}
          />
        </View>
      </FadeInCard>

      <FadeInCard delay={70}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#64748b" }}>Ingresos</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#0f172a" }}>{stats?.ingresos ?? "-"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#64748b" }}>Salidas</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#0f172a" }}>{stats?.salidas ?? "-"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#64748b" }}>Total</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#0f172a" }}>{stats?.total ?? "-"}</Text>
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={120}>
        <View style={{ gap: 8 }}>
          <ModernButton label="Escanear QR / Barras" onPress={() => router.push("/guard/scan" as any)} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ModernButton label="Historial" tone="light" onPress={() => router.push("/guard/historial" as any)} />
            </View>
            <View style={{ flex: 1 }}>
              <ModernButton label="Alertas" tone="light" onPress={() => router.push("/guard/alertas" as any)} />
            </View>
          </View>
          <ModernButton
            label="Cerrar turno"
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
            label="Cerrar sesion"
            tone="dark"
            onPress={async () => {
              await signOut();
              router.replace("/" as any);
            }}
          />
        </View>
      </FadeInCard>

      <FadeInCard delay={160}>
        <Text style={{ fontSize: 16, fontWeight: "900", color: "#0f172a", marginBottom: 8 }}>Registros recientes</Text>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={recientes}
            scrollEnabled={false}
            keyExtractor={(i) => String(i.id)}
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: "#f8fafc",
                  borderWidth: 1,
                  borderColor: "#e2e8f0",
                  borderRadius: 12,
                  padding: 10,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontWeight: "900", color: "#0f172a" }}>
                  #{item.id} - {item.tipo.toUpperCase()}
                </Text>
                <Text style={{ color: "#64748b" }}>{new Date(item.fecha).toLocaleString()}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={{ color: "#64748b" }}>Aun no hay registros.</Text>}
          />
        )}
      </FadeInCard>
    </ModernScreen>
  );
}
