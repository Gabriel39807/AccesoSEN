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
type Equipo = { id: number; serial: string; marca: string; modelo: string; estado: string };

const themes = {
  light: {
    background: ["#fbfdff", "#f3f8ff", "#e8f1ff"] as [string, string, string],
    ambientTop: ["rgba(109,190,245,0.13)", "rgba(109,190,245,0.03)", "transparent"] as [string, string, string],
    ambientBeam: ["transparent", "rgba(196,230,255,0.16)", "rgba(255,255,255,0.05)"] as [string, string, string],
    ambientBottom: ["rgba(255,255,255,0.03)", "rgba(221,238,255,0.20)", "rgba(243,249,255,0.22)"] as [string, string, string],
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
  const [equipos, setEquipos] = useState<Equipo[]>([]);

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
        const r = await api.get<Equipo[] | { results: Equipo[] }>("/api/equipos/");
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
              shadowColor: isDark ? "rgba(0,0,0,0.28)" : "rgba(133, 181, 225, 0.18)",
            },
          ]}
        >
          <LinearGradient
            colors={mode === "dark" ? ["rgba(79,201,255,0.16)", "rgba(79,201,255,0.03)", "transparent"] : ["rgba(255,255,255,0.72)", "rgba(170,223,255,0.16)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.credentialGlow}
          />

          <View style={[styles.identityHeader, { borderColor: theme.line, backgroundColor: mode === "dark" ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.22)" }]}>
            <View style={[styles.avatarFrame, { backgroundColor: theme.accentSoft, borderColor: theme.cardBorder }]}>
              <LinearGradient
                colors={mode === "dark" ? ["rgba(79,201,255,0.18)", "rgba(79,201,255,0.05)"] : ["rgba(255,255,255,0.78)", "rgba(14,165,233,0.04)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="person-outline" size={38} color={theme.accentStrong} />
            </View>

            <View style={styles.identityMain}>
              <Text style={[styles.credentialEyebrow, { color: theme.textSoft }]}>Perfil del estudiante</Text>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
                {fullName}
              </Text>

              <View style={[styles.documentBadge, { backgroundColor: theme.accentSoft, borderColor: theme.line }]}>
                <Ionicons name="card-outline" size={14} color={theme.accentStrong} />
                <View style={styles.documentBadgeCopy}>
                  <Text style={[styles.documentLabel, { color: theme.textSoft }]}>Documento</Text>
                  <Text style={[styles.document, { color: theme.textMuted }]} numberOfLines={1}>
                    {documento}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.programBanner, { backgroundColor: theme.accentSoft, borderColor: theme.line }]}>
            <View style={[styles.programIcon, { backgroundColor: theme.cardBg, borderColor: theme.line }]}>
              <Ionicons name="school-outline" size={15} color={theme.accentStrong} />
            </View>
            <View style={styles.programCopy}>
              <Text style={[styles.metaLabel, { color: theme.textSoft }]}>Programa</Text>
              <Text style={[styles.programValue, { color: theme.text }]} numberOfLines={2}>
                {programa}
              </Text>
            </View>
          </View>

          <View style={[styles.metaBoard, { borderColor: theme.line, backgroundColor: mode === "dark" ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.24)" }]}>
            <View style={styles.metaBoardItem}>
                <Text style={[styles.metaLabel, { color: theme.textSoft }]}>Sede</Text>
                <Text style={[styles.metaBoardValue, { color: theme.text }]} numberOfLines={2}>
                  {sede}
                </Text>
            </View>
            <View style={[styles.metaBoardDivider, { backgroundColor: theme.line }]} />
            <View style={styles.metaBoardItem}>
                <Text style={[styles.metaLabel, { color: theme.textSoft }]}>Jornada</Text>
                <Text style={[styles.metaBoardValue, { color: theme.text }]} numberOfLines={2}>
                  {String(jornada)}
                </Text>
            </View>
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
            <View style={styles.equiposTitleWrap}>
              <Text style={[styles.equiposTitle, { color: theme.text }]}>Mis equipos</Text>
              <Text style={[styles.equiposCount, { color: theme.textSoft }]}>
                {loadingEquipos ? "Consultando..." : `${equipos.length} registrado${equipos.length === 1 ? "" : "s"}`}
              </Text>
            </View>

            <Pressable onPress={() => router.push("/aprendiz/equipos" as any)} style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}>
              <Text style={[styles.viewAll, { color: theme.accentStrong }]}>Ver todos</Text>
            </Pressable>
          </View>

          {loadingEquipos ? (
            <View style={[styles.loadingState, { borderColor: theme.line, backgroundColor: mode === "dark" ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.28)" }]}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : previewEquipos.length > 0 ? (
            <View style={styles.equiposList}>
              {previewEquipos.map((item) => (
                <EquipoPreviewCard key={item.id} item={item} theme={theme} mode={mode} />
              ))}
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: mode === "dark" ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.28)", borderColor: theme.line }]}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="cube-outline" size={16} color={theme.accentStrong} />
              </View>
              <View style={styles.emptyCopy}>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin equipos registrados</Text>
                <Text style={[styles.emptyText, { color: theme.textSoft }]}>Agrega tu primer dispositivo desde el modulo de equipos.</Text>
              </View>
            </View>
          )}

          <Pressable onPress={() => router.push("/aprendiz/equipos" as any)} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}>
            <View style={[styles.registerAction, { borderColor: theme.line, backgroundColor: mode === "dark" ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.28)" }]}>
              <View style={styles.registerCopy}>
                <Text style={[styles.registerTitle, { color: theme.text }]}>Registrar nuevo</Text>
                <Text style={[styles.registerText, { color: theme.textSoft }]}>Agregar otro equipo</Text>
              </View>
              <Ionicons name="add" size={18} color={theme.accentStrong} />
            </View>
          </Pressable>
        </View>
      </View>

      <AprendizBottomDock active="inicio" />
    </View>
  );
}

function EquipoPreviewCard({
  item,
  theme,
  mode,
}: {
  item: Equipo;
  theme: (typeof themes)["light"];
  mode: Mode;
}) {
  const status = (item.estado || "Pendiente").toUpperCase();

  return (
    <View style={[styles.equipoCard, { backgroundColor: mode === "dark" ? "rgba(255,255,255,0.014)" : "rgba(255,255,255,0.26)", borderColor: theme.line }]}>
      <View style={styles.equipoRow}>
        <View style={[styles.equipoIcon, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="cube-outline" size={16} color={theme.accentStrong} />
        </View>

        <View style={styles.equipoCopy}>
          <Text style={[styles.equipoName, { color: theme.text }]} numberOfLines={1}>
            {[item.marca, item.modelo].filter(Boolean).join(" ") || "Equipo registrado"}
          </Text>
          <Text style={[styles.equipoSerial, { color: theme.textSoft }]} numberOfLines={1}>
            {item.serial || "-"}
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: theme.accentSoft, borderColor: theme.line }]}>
          <Text style={[styles.statusText, { color: theme.accentStrong }]} numberOfLines={1}>
            {status}
          </Text>
        </View>
      </View>
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
    gap: 13,
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
    position: "relative",
    overflow: "hidden",
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 17,
    gap: 9,
    shadowOpacity: 0.1,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
  },
  credentialGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 116,
  },
  identityHeader: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  credentialEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  avatarFrame: {
    width: 84,
    minHeight: 110,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  identityMain: {
    flex: 1,
    justifyContent: "space-between",
    gap: 10,
  },
  name: {
    fontSize: 29,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -0.95,
  },
  documentLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  document: {
    fontSize: 14,
    fontWeight: "800",
  },
  documentBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  documentBadgeCopy: {
    gap: 1,
  },
  programBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 11,
  },
  programIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  programCopy: {
    flex: 1,
    gap: 2,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  programValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  metaBoard: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    overflow: "hidden",
  },
  metaBoardItem: {
    flex: 1,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 3,
  },
  metaBoardDivider: {
    width: 1,
  },
  metaBoardValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },
  equiposCard: {
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 15,
    gap: 8,
    shadowOpacity: 0.08,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
  },
  equiposHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  equiposTitleWrap: {
    flex: 1,
    gap: 3,
  },
  equiposTitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  equiposCount: {
    fontSize: 11,
    fontWeight: "600",
  },
  viewAll: {
    fontSize: 12,
    fontWeight: "800",
  },
  loadingState: {
    minHeight: 64,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  equiposList: {
    gap: 6,
  },
  equipoCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  equipoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  equipoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  equipoCopy: {
    flex: 1,
    gap: 2,
  },
  equipoName: {
    fontSize: 13,
    fontWeight: "800",
  },
  equipoSerial: {
    fontSize: 11,
    fontWeight: "600",
  },
  statusBadge: {
    maxWidth: 88,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  emptyState: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 11,
  },
  emptyIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
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
  registerAction: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  registerCopy: {
    flex: 1,
    gap: 2,
  },
  registerTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  registerText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
});
