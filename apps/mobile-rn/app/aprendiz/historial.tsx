import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../src/api/client";
import { useResolvedThemeMode } from "../../src/store/preferences";

type AccesoItem = {
  id: number;
  tipo: "ingreso" | "salida";
  fecha: string;
  sede?: string;
};

type Mode = "light" | "dark";

const themes = {
  light: {
    background: ["#fbfdff", "#f3f8ff", "#e8f1ff"] as [string, string, string],
    ambientTop: ["rgba(109,190,245,0.13)", "rgba(109,190,245,0.03)", "transparent"] as [string, string, string],
    ambientBeam: ["transparent", "rgba(196,230,255,0.16)", "rgba(255,255,255,0.05)"] as [string, string, string],
    ambientBottom: ["rgba(255,255,255,0.03)", "rgba(221,238,255,0.20)", "rgba(243,249,255,0.22)"] as [string, string, string],
    meshBorder: "rgba(173, 210, 237, 0.20)",
    cardBg: "rgba(255,255,255,0.80)",
    cardBorder: "rgba(96, 173, 229, 0.18)",
    rowBg: "rgba(255,255,255,0.58)",
    text: "#132844",
    textMuted: "#4f6d8e",
    textSoft: "#7b93ad",
    accent: "#0b89d1",
    accentStrong: "#0875b3",
    accentSoft: "rgba(14,165,233,0.10)",
    line: "rgba(96, 173, 229, 0.12)",
  },
  dark: {
    background: ["#07111c", "#0a1b2c", "#0f3044"] as [string, string, string],
    ambientTop: ["rgba(82,195,255,0.13)", "rgba(82,195,255,0.03)", "transparent"] as [string, string, string],
    ambientBeam: ["transparent", "rgba(25,144,209,0.10)", "transparent"] as [string, string, string],
    ambientBottom: ["transparent", "rgba(37,164,229,0.08)", "rgba(37,164,229,0.02)"] as [string, string, string],
    meshBorder: "rgba(96, 177, 230, 0.10)",
    cardBg: "rgba(12,24,38,0.74)",
    cardBorder: "rgba(71, 181, 245, 0.18)",
    rowBg: "rgba(255,255,255,0.03)",
    text: "#f6fbff",
    textMuted: "#d0eaf8",
    textSoft: "#8fb0c4",
    accent: "#4fc9ff",
    accentStrong: "#1eb2ee",
    accentSoft: "rgba(79,201,255,0.12)",
    line: "rgba(79,201,255,0.12)",
  },
};

export default function AprendizHistorial() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AccesoItem[]>([]);
  const insets = useSafeAreaInsets();
  const mode = useResolvedThemeMode() as Mode;
  const theme = themes[mode];
  const isDark = mode === "dark";

  async function cargar() {
    setLoading(true);
    try {
      const r = await api.get<AccesoItem[]>("/api/accesos/mis_accesos/");
      setRows(Array.isArray(r.data) ? r.data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  const summary = useMemo(() => {
    const ingresos = rows.filter((row) => row.tipo === "ingreso").length;
    const salidas = rows.filter((row) => row.tipo === "salida").length;
    return { ingresos, salidas, total: rows.length };
  }, [rows]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background[0] }]}>
      <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={theme.ambientTop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ambientTop} />
      <LinearGradient colors={theme.ambientBeam} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ambientBeam} />
      <LinearGradient colors={theme.ambientBottom} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.ambientBottom} />
      <FlatList
        data={rows}
        keyExtractor={(i) => String(i.id)}
        style={styles.list}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: 28 + Math.max(insets.bottom, 8) }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <View style={styles.topBar}>
              <Pressable
                onPress={() => router.push("/aprendiz/perfil" as any)}
                style={({ pressed }) => [
                  styles.backButton,
                  {
                    opacity: pressed ? 0.72 : 1,
                    borderColor: theme.cardBorder,
                    backgroundColor: theme.rowBg,
                  },
                ]}
              >
                <Ionicons name="arrow-back" size={18} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Historial</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSoft }]}>Consulta tus ingresos y salidas recientes.</Text>
            </View>

            <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, shadowColor: isDark ? "rgba(0,0,0,0.28)" : "rgba(138, 187, 227, 0.18)" }]}>
              <Metric label="Ingresos" value={summary.ingresos} icon="log-in-outline" theme={theme} />
              <Metric label="Salidas" value={summary.salidas} icon="log-out-outline" theme={theme} />
              <Metric label="Total" value={summary.total} icon="layers-outline" theme={theme} />
            </View>

            <View style={styles.refreshRow}>
              <Pressable onPress={() => void cargar()} style={({ pressed }) => [{ opacity: pressed ? 0.76 : 1 }]}>
                <View style={[styles.refreshPill, { backgroundColor: theme.accentSoft, borderColor: theme.cardBorder }]}>
                  <Ionicons name="refresh-outline" size={15} color={theme.accentStrong} />
                  <Text style={[styles.refreshText, { color: theme.accentStrong }]}>{loading ? "Actualizando" : "Actualizar"}</Text>
                </View>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isIngreso = item.tipo === "ingreso";
          const accent = isIngreso ? "#12a66d" : "#f59e0b";

          return (
            <View style={[styles.rowCard, { backgroundColor: theme.rowBg, borderColor: theme.line }]}>
              <View style={[styles.rowIcon, { backgroundColor: `${accent}16` }]}>
                <Ionicons name={isIngreso ? "log-in-outline" : "log-out-outline"} size={18} color={accent} />
              </View>
              <View style={styles.rowCopy}>
                <View style={styles.rowTop}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>{isIngreso ? "Ingreso" : "Salida"}</Text>
                  <Text style={[styles.rowDate, { color: theme.textSoft }]}>{new Date(item.fecha).toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.rowMeta, { color: theme.textMuted }]}>{new Date(item.fecha).toLocaleTimeString()}</Text>
                <Text style={[styles.rowMeta, { color: theme.textSoft }]}>Sede {item.sede || "-"}</Text>
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator color={theme.accentStrong} />
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="time-outline" size={20} color={theme.accentStrong} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Aun no hay movimientos</Text>
              <Text style={[styles.emptyText, { color: theme.textSoft }]}>Tus registros de acceso apareceran aqui cuando uses tu credencial.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

function Metric({
  label,
  value,
  icon,
  theme,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  theme: (typeof themes)["light"];
}) {
  return (
    <View style={[styles.metricItem, { backgroundColor: theme.rowBg, borderColor: theme.line }]}>
      <Ionicons name={icon} size={16} color={theme.accentStrong} />
      <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: theme.textSoft }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { flex: 1 },
  ambientTop: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
  ambientBeam: {
    position: "absolute",
    top: 130,
    left: -34,
    right: -34,
    height: 260,
    transform: [{ rotate: "-7deg" }],
  },
  ambientBottom: { position: "absolute", left: 0, right: 0, bottom: 40, height: 230 },
  content: {
    paddingHorizontal: 22,
    gap: 12,
  },
  headerStack: {
    gap: 12,
    marginBottom: 12,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    gap: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  summaryCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  metricItem: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 92,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "900",
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  refreshRow: {
    alignItems: "flex-start",
  },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: "800",
  },
  rowCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  rowDate: {
    fontSize: 12,
    fontWeight: "700",
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});
