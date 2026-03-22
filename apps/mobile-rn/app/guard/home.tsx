import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSessionStore } from "../../src/store/session";
import { api } from "../../src/api/client";
import * as Accesos from "../../src/api/accesos";
import { EmptyState, FadeInCard, ModernButton, ModernScreen, Pill, SkeletonList } from "../../src/ui/modern";

type AccesoRow = { id: number; tipo: "ingreso" | "salida"; fecha: string; aprendiz_nombre?: string };

function StatTile({ icon, label, value, tone }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | number; tone: "green" | "amber" | "blue" }) {
  const palette = {
    green: { bg: "rgba(66,199,154,0.14)", border: "rgba(66,199,154,0.24)", fg: "#D8FFF1" },
    amber: { bg: "rgba(240,178,77,0.14)", border: "rgba(240,178,77,0.24)", fg: "#FFE8BF" },
    blue: { bg: "rgba(79,163,255,0.14)", border: "rgba(79,163,255,0.24)", fg: "#E9F3FF" },
  }[tone];

  return (
    <View style={[styles.statTile, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Ionicons name={icon} size={18} color={palette.fg} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RecordRow({ item }: { item: AccesoRow }) {
  const ingreso = item.tipo.toLowerCase() === "ingreso";
  return (
    <View style={styles.recordRow}>
      <View style={[styles.recordIconWrap, ingreso ? styles.recordIconIngreso : styles.recordIconSalida]}>
        <Ionicons name={ingreso ? "log-in-outline" : "log-out-outline"} size={18} color={ingreso ? "#D8FFF1" : "#FFE8BF"} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.recordTitle}>{item.aprendiz_nombre || `Registro #${item.id}`}</Text>
        <Text style={styles.recordMeta}>
          {item.tipo.toUpperCase()} · {new Date(item.fecha).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
      <Text style={styles.recordDate}>{new Date(item.fecha).toLocaleDateString()}</Text>
    </View>
  );
}

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
      setRecientes(results.slice(0, 5));
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
    <ModernScreen scroll theme="guard">
      <FadeInCard delay={0} intensity={90} style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={{ gap: 10, flex: 1 }}>
            <Pill text="Guardia activa" icon="shield-checkmark-outline" tone="guard" />
            <View style={{ gap: 6 }}>
              <Text style={styles.heroTitle}>Hola, {user?.first_name || user?.username || "Guarda"}</Text>
              <Text style={styles.heroSubtitle}>Controla accesos con foco operativo, trazabilidad y velocidad de respuesta.</Text>
            </View>
          </View>
          <View style={styles.heroAvatar}>
            <Ionicons name="person-outline" size={22} color="#F3F7FB" />
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBadge}>
            <Ionicons name="business-outline" size={14} color="#B8C3D1" />
            <Text style={styles.metaBadgeText}>{turno?.sede ?? "Sin sede"}</Text>
          </View>
          <View style={styles.metaBadge}>
            <Ionicons name="time-outline" size={14} color="#B8C3D1" />
            <Text style={styles.metaBadgeText}>{turno?.jornada ?? "Sin jornada"}</Text>
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={70} intensity={70} style={{ gap: 14 }}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Resumen del turno</Text>
          <Pressable onPress={() => { cargarStats(); cargarRecientes(); }}>
            <Ionicons name="refresh-outline" size={18} color="#B8C3D1" />
          </Pressable>
        </View>
        <View style={styles.statsRow}>
          <StatTile icon="enter-outline" label="Ingresos" value={stats?.ingresos ?? "-"} tone="green" />
          <StatTile icon="exit-outline" label="Salidas" value={stats?.salidas ?? "-"} tone="amber" />
          <StatTile icon="people-outline" label="Total" value={stats?.total ?? "-"} tone="blue" />
        </View>
      </FadeInCard>

      <FadeInCard delay={140} intensity={75} style={{ gap: 14 }}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Operacion inmediata</Text>
          <Pill text="Listo para escanear" icon="scan-outline" tone="guard" />
        </View>

        <Pressable style={styles.scanHero} onPress={() => router.push("/guard/scan" as any)}>
          <View style={styles.scanHeroIcon}>
            <Ionicons name="scan-outline" size={28} color="#F3F7FB" />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.scanHeroTitle}>Escanear acceso</Text>
            <Text style={styles.scanHeroSubtitle}>Abre el visor para validar documento o QR en segundos.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#B8C3D1" />
        </Pressable>

        <View style={styles.actionRow}>
          <View style={{ flex: 1 }}>
            <ModernButton icon="time-outline" label="Historial" tone="light" onPress={() => router.push("/guard/historial" as any)} />
          </View>
          <View style={{ flex: 1 }}>
            <ModernButton icon="notifications-outline" label="Alertas" tone="light" onPress={() => router.push("/guard/alertas" as any)} />
          </View>
        </View>
        <View style={styles.actionRow}>
          <View style={{ flex: 1 }}>
            <ModernButton
              icon="stop-circle-outline"
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
          </View>
          <View style={{ flex: 1 }}>
            <ModernButton
              icon="log-out-outline"
              label="Salir"
              tone="dark"
              onPress={async () => {
                await signOut();
                router.replace("/" as any);
              }}
            />
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={210} intensity={65} style={{ gap: 14, marginBottom: 40 }}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Actividad reciente</Text>
          <Text style={styles.sectionCaption}>Ultimos movimientos</Text>
        </View>

        {loading ? (
          <SkeletonList items={4} />
        ) : (
          <FlatList
            data={recientes}
            scrollEnabled={false}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <RecordRow item={item} />}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={<EmptyState icon="file-tray-outline" title="Sin registros" subtitle="Aun no hay accesos recientes para mostrar." />}
          />
        )}
      </FadeInCard>
    </ModernScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: 16,
  },
  heroHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    color: "#F3F7FB",
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#B8C3D1",
  },
  heroAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(79,163,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(79,163,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaBadgeText: {
    fontSize: 12,
    color: "#B8C3D1",
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F3F7FB",
    letterSpacing: -0.4,
  },
  sectionCaption: {
    fontSize: 12,
    color: "#7F90A3",
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statTile: {
    flex: 1,
    minHeight: 112,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  statValue: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "900",
    color: "#F3F7FB",
    letterSpacing: -0.8,
  },
  statLabel: {
    fontSize: 12,
    color: "#B8C3D1",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  scanHero: {
    minHeight: 108,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(79,163,255,0.24)",
    backgroundColor: "rgba(79,163,255,0.12)",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  scanHeroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanHeroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F3F7FB",
  },
  scanHeroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: "#B8C3D1",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  recordRow: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recordIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  recordIconIngreso: {
    backgroundColor: "rgba(66,199,154,0.14)",
    borderColor: "rgba(66,199,154,0.24)",
  },
  recordIconSalida: {
    backgroundColor: "rgba(240,178,77,0.14)",
    borderColor: "rgba(240,178,77,0.24)",
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F3F7FB",
  },
  recordMeta: {
    fontSize: 12,
    color: "#B8C3D1",
  },
  recordDate: {
    fontSize: 12,
    color: "#7F90A3",
    fontWeight: "600",
  },
});
