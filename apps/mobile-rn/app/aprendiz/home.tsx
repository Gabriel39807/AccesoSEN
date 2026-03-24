import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AprendizBottomDock from "../../src/components/aprendiz/AprendizBottomDock";
import { api } from "../../src/api/client";
import { useSessionStore } from "../../src/store/session";
import { useResolvedThemeMode } from "../../src/store/preferences";

type Mode = "light" | "dark";

const themes = {
  light: {
    background: ["#fbfdff", "#f3f8ff", "#e8f1ff"] as [string, string, string],
    ambientTop: ["rgba(109,190,245,0.13)", "rgba(109,190,245,0.03)", "transparent"] as [string, string, string],
    ambientBeam: ["transparent", "rgba(196,230,255,0.16)", "rgba(255,255,255,0.05)"] as [string, string, string],
    ambientBottom: ["rgba(255,255,255,0.03)", "rgba(221,238,255,0.20)", "rgba(243,249,255,0.22)"] as [string, string, string],
    meshBorder: "rgba(173, 210, 237, 0.20)",
    cardBg: "rgba(255,255,255,0.78)",
    cardBorder: "rgba(96, 173, 229, 0.18)",
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
    cardBg: "rgba(12,24,38,0.72)",
    cardBorder: "rgba(71, 181, 245, 0.18)",
    text: "#f6fbff",
    textMuted: "#d0eaf8",
    textSoft: "#8fb0c4",
    accent: "#4fc9ff",
    accentStrong: "#1eb2ee",
    accentSoft: "rgba(79,201,255,0.12)",
    line: "rgba(79,201,255,0.12)",
  },
};

export default function AprendizHome() {
  const user = useSessionStore((s) => s.user);
  const insets = useSafeAreaInsets();
  const mode = useResolvedThemeMode() as Mode;
  const theme = themes[mode];
  const isDark = mode === "dark";
  const [loadingEquipos, setLoadingEquipos] = useState(true);
  const [equipos, setEquipos] = useState<{ id: number; serial: string; marca: string; modelo: string; estado: string }[]>([]);

  const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.username || "Aprendiz";
  const documento = user?.documento || "-";
  const programa = user?.programa_formacion || "-";
  const sede = (user as any)?.sede_principal || "-";
  const jornada = (user as any)?.jornada || "-";

  useEffect(() => {
    let cancelled = false;

    async function loadEquipos() {
      setLoadingEquipos(true);
      try {
        const r = await api.get<{ id: number; serial: string; marca: string; modelo: string; estado: string }[] | { results: { id: number; serial: string; marca: string; modelo: string; estado: string }[] }>("/api/equipos/");
        const data = Array.isArray(r.data) ? r.data : r.data?.results ?? [];
        if (!cancelled) setEquipos(data);
      } catch {
        if (!cancelled) setEquipos([]);
      } finally {
        if (!cancelled) setLoadingEquipos(false);
      }
    }

    void loadEquipos();
    return () => {
      cancelled = true;
    };
  }, []);

  const previewEquipos = useMemo(() => equipos.slice(0, 2), [equipos]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background[0] }]}>
      <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={theme.ambientTop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ambientTop} />
      <LinearGradient colors={theme.ambientBeam} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ambientBeam} />
      <LinearGradient colors={theme.ambientBottom} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.ambientBottom} />
      <View style={[styles.content, { paddingTop: insets.top + 18, paddingBottom: 132 + Math.max(insets.bottom, 8) }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.textSoft }]}>Identificacion digital</Text>
        </View>

        <View
          style={[
            styles.credentialCard,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
              shadowColor: mode === "light" ? "rgba(133, 181, 225, 0.18)" : "rgba(0,0,0,0.28)",
            },
          ]}
        >
          <View style={styles.identityRow}>
            <View style={[styles.avatarShell, { backgroundColor: theme.accentSoft, borderColor: theme.cardBorder, shadowColor: isDark ? "rgba(0,0,0,0.24)" : "rgba(90, 165, 225, 0.16)" }]}>
              <LinearGradient
                colors={mode === "dark" ? ["rgba(79,201,255,0.18)", "rgba(79,201,255,0.04)"] : ["rgba(255,255,255,0.72)", "rgba(14,165,233,0.02)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="person-outline" size={36} color={theme.accentStrong} />
            </View>

            <View style={styles.nameWrap}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
                {fullName}
              </Text>
              <Text style={[styles.documentLabel, { color: theme.textSoft }]}>Documento</Text>
              <Text style={[styles.document, { color: theme.textMuted }]}>{documento}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.line }]} />

          <View style={styles.detailsStack}>
            <CredentialLine label="Programa" value={programa} theme={theme} />
            <CredentialLine label="Sede" value={sede} theme={theme} />
            <CredentialLine label="Jornada" value={String(jornada)} theme={theme} />
          </View>
        </View>

        <View
          style={[
            styles.equiposCard,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
              shadowColor: isDark ? "rgba(0,0,0,0.24)" : "rgba(133, 181, 225, 0.14)",
            },
          ]}
        >
          <View style={styles.equiposHeader}>
            <View>
              <Text style={[styles.equiposTitle, { color: theme.text }]}>Mis equipos</Text>
              <Text style={[styles.equiposSubtitle, { color: theme.textSoft }]}>
                {loadingEquipos ? "Consultando equipos registrados..." : `${equipos.length} registrado${equipos.length === 1 ? "" : "s"}`}
              </Text>
            </View>

            <Pressable onPress={() => router.push("/aprendiz/equipos" as any)} style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}>
              <Text style={[styles.viewAll, { color: theme.accentStrong }]}>Ver todos</Text>
            </Pressable>
          </View>

          {loadingEquipos ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : previewEquipos.length > 0 ? (
            <View style={styles.equiposList}>
              {previewEquipos.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.equipoRow,
                    {
                      backgroundColor: mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.58)",
                      borderColor: theme.line,
                    },
                  ]}
                >
                  <View style={[styles.equipoIcon, { backgroundColor: theme.accentSoft }]}>
                    <Ionicons name="cube-outline" size={16} color={theme.accent} />
                  </View>
                  <View style={styles.equipoCopy}>
                    <Text style={[styles.equipoName, { color: theme.text }]}>{item.marca} {item.modelo}</Text>
                    <Text style={[styles.equipoMeta, { color: theme.textSoft }]} numberOfLines={1}>
                      {item.serial} · {item.estado}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.52)", borderColor: theme.line }]}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="cube-outline" size={16} color={theme.accentStrong} />
              </View>
              <View style={styles.emptyCopy}>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin equipos registrados</Text>
                <Text style={[styles.emptyText, { color: theme.textSoft }]}>Puedes agregarlos desde el detalle de equipos cuando los necesites.</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <AprendizBottomDock active="inicio" />
    </View>
  );
}

function CredentialLine({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: (typeof themes)["light"];
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: theme.textSoft }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  ambientTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  ambientBeam: {
    position: "absolute",
    top: 130,
    left: -34,
    right: -34,
    height: 260,
    transform: [{ rotate: "-7deg" }],
  },
  ambientBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 104,
    height: 230,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: "center",
    gap: 16,
  },
  header: {
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  credentialCard: {
    borderRadius: 32,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 26,
    gap: 20,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 9 },
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  avatarShell: {
    width: 78,
    height: 78,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  nameWrap: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -1,
  },
  documentLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  document: {
    fontSize: 17,
    fontWeight: "800",
  },
  divider: {
    height: 1,
  },
  detailsStack: {
    gap: 14,
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 23,
  },
  equiposCard: {
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 15,
    gap: 12,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
  },
  equiposHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  equiposTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  equiposSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
  },
  viewAll: {
    fontSize: 12,
    fontWeight: "800",
  },
  equiposList: {
    gap: 8,
  },
  equipoRow: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  equipoIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  equipoCopy: {
    flex: 1,
    gap: 2,
  },
  equipoName: {
    fontSize: 14,
    fontWeight: "800",
  },
  equipoMeta: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  emptyIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCopy: {
    flex: 1,
    gap: 2,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
});
