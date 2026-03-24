import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Auth from "../../src/api/auth";
import { toUiErrorMessage } from "../../src/api/client";
import AprendizBottomDock from "../../src/components/aprendiz/AprendizBottomDock";
import { usePreferencesStore, useResolvedThemeMode } from "../../src/store/preferences";
import { useSessionStore } from "../../src/store/session";
import { ModernButton } from "../../src/ui/modern";

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
    sectionBg: "rgba(255,255,255,0.72)",
    rowBg: "rgba(255,255,255,0.58)",
    text: "#132844",
    textMuted: "#4f6d8e",
    textSoft: "#7b93ad",
    accent: "#0b89d1",
    accentStrong: "#0875b3",
    accentSoft: "rgba(14,165,233,0.10)",
    line: "rgba(96, 173, 229, 0.12)",
    danger: "#c2410c",
  },
  dark: {
    background: ["#07111c", "#0a1b2c", "#0f3044"] as [string, string, string],
    ambientTop: ["rgba(82,195,255,0.13)", "rgba(82,195,255,0.03)", "transparent"] as [string, string, string],
    ambientBeam: ["transparent", "rgba(25,144,209,0.10)", "transparent"] as [string, string, string],
    ambientBottom: ["transparent", "rgba(37,164,229,0.08)", "rgba(37,164,229,0.02)"] as [string, string, string],
    meshBorder: "rgba(96, 177, 230, 0.10)",
    cardBg: "rgba(12,24,38,0.74)",
    cardBorder: "rgba(71, 181, 245, 0.18)",
    sectionBg: "rgba(12,24,38,0.66)",
    rowBg: "rgba(255,255,255,0.03)",
    text: "#f6fbff",
    textMuted: "#d0eaf8",
    textSoft: "#8fb0c4",
    accent: "#4fc9ff",
    accentStrong: "#1eb2ee",
    accentSoft: "rgba(79,201,255,0.12)",
    line: "rgba(79,201,255,0.12)",
    danger: "#ff9b71",
  },
};

export default function AprendizPerfil() {
  const [perfil, setPerfil] = useState<Auth.AprendizPerfil | null>(null);
  const [loadingPerfil, setLoadingPerfil] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const signOut = useSessionStore((s) => s.signOut);
  const mode = useResolvedThemeMode() as Mode;
  const theme = themes[mode];
  const isDark = mode === "dark";
  const toggleThemeMode = usePreferencesStore((s) => s.toggleThemeMode);
  const insets = useSafeAreaInsets();

  async function loadPerfil() {
    setLoadingPerfil(true);
    try {
      const r = await Auth.getAprendizPerfil();
      setPerfil(r.perfil);
      setMsg(null);
    } catch (e: any) {
      setMsg(toUiErrorMessage(e, "No se pudo cargar el perfil."));
    } finally {
      setLoadingPerfil(false);
    }
  }

  useEffect(() => {
    void loadPerfil();
  }, []);

  const fullName = `${perfil?.first_name || ""} ${perfil?.last_name || ""}`.trim() || "Aprendiz";

  return (
    <View style={[styles.root, { backgroundColor: theme.background[0] }]}>
      <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={theme.ambientTop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ambientTop} />
      <LinearGradient colors={theme.ambientBeam} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ambientBeam} />
      <LinearGradient colors={theme.ambientBottom} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.ambientBottom} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 18,
            paddingBottom: 132 + Math.max(insets.bottom, 20),
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Perfil</Text>
        </View>

        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
              shadowColor: isDark ? "rgba(0,0,0,0.28)" : "rgba(138, 187, 227, 0.18)",
            },
          ]}
        >
          <View style={styles.profileTop}>
            <View style={[styles.avatarShell, { backgroundColor: theme.accentSoft, borderColor: theme.cardBorder }]}>
              <LinearGradient
                colors={mode === "dark" ? ["rgba(79,201,255,0.18)", "rgba(79,201,255,0.04)"] : ["rgba(255,255,255,0.72)", "rgba(14,165,233,0.02)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="person-outline" size={34} color={theme.accentStrong} />
            </View>

            <View style={styles.identityWrap}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
                {loadingPerfil ? "Cargando..." : fullName}
              </Text>
              <Text style={[styles.document, { color: theme.textMuted }]}>Documento {perfil?.documento || "-"}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.line }]} />

          {loadingPerfil ? (
            <ActivityIndicator color={theme.accentStrong} style={{ marginTop: 6 }} />
          ) : (
            <View style={styles.metaGrid}>
              <MetaItem icon="mail-outline" label="Correo" value={perfil?.email || "Sin correo"} theme={theme} />
              <MetaItem icon="call-outline" label="Telefono" value={perfil?.telefono || "Sin telefono"} theme={theme} />
              <MetaItem icon="business-outline" label="Sede" value={perfil?.sede_principal || "Sin sede"} theme={theme} full />
            </View>
          )}

          {msg ? <Text style={[styles.errorText, { color: theme.danger }]}>{msg}</Text> : null}
        </View>

        <Section title="Cuenta" theme={theme}>
          <SettingRow
            icon="time-outline"
            title="Historial"
            subtitle="Tus accesos"
            theme={theme}
            onPress={() => router.push("/aprendiz/historial" as any)}
          />
          <SettingRow
            icon="help-circle-outline"
            title="Ayuda"
            subtitle="Soporte rapido"
            theme={theme}
            onPress={() => router.push("/aprendiz/ayuda" as any)}
          />
        </Section>

        <Section title="Preferencias" theme={theme}>
          <View style={[styles.settingRow, { backgroundColor: theme.rowBg, borderColor: theme.line }]}>
            <View style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name={mode === "dark" ? "moon-outline" : "sunny-outline"} size={17} color={theme.accentStrong} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Tema</Text>
              <Text style={[styles.rowSubtitle, { color: theme.textSoft }]}>{mode === "dark" ? "Modo oscuro" : "Modo claro"}</Text>
            </View>
            <Switch
              value={mode === "dark"}
              onValueChange={toggleThemeMode}
              trackColor={{ false: "rgba(148,163,184,0.35)", true: theme.accentStrong }}
              thumbColor="#ffffff"
            />
          </View>
        </Section>

        <View style={styles.sessionBlock}>
          <Text style={[styles.sectionTitle, { color: theme.textSoft }]}>Sesion</Text>
          <ModernButton
            icon="log-out-outline"
            label="Cerrar sesion"
            tone="danger"
            onPress={async () => {
              await signOut();
              router.replace("/" as any);
            }}
          />
        </View>
      </ScrollView>

      <AprendizBottomDock active="perfil" />
    </View>
  );
}

function Section({
  title,
  theme,
  children,
}: {
  title: string;
  theme: (typeof themes)["light"];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={[styles.sectionTitle, { color: theme.textSoft }]}>{title}</Text>
      <View style={styles.sectionRows}>{children}</View>
    </View>
  );
}

function MetaItem({
  icon,
  label,
  value,
  theme,
  full = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  theme: (typeof themes)["light"];
  full?: boolean;
}) {
  return (
    <View style={[styles.metaItem, full ? styles.metaItemFull : null, { backgroundColor: theme.rowBg, borderColor: theme.line }]}>
      <View style={[styles.metaIcon, { backgroundColor: theme.accentSoft }]}>
        <Ionicons name={icon} size={15} color={theme.accentStrong} />
      </View>
      <View style={styles.metaCopy}>
        <Text style={[styles.metaLabel, { color: theme.textSoft }]}>{label}</Text>
        <Text style={[styles.metaValue, { color: theme.text }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  theme,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  theme: (typeof themes)["light"];
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      <View style={[styles.settingRow, { backgroundColor: theme.rowBg, borderColor: theme.line }]}>
        <View style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name={icon} size={17} color={theme.accentStrong} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.rowSubtitle, { color: theme.textSoft }]}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSoft} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
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
    paddingHorizontal: 22,
    gap: 18,
  },
  header: {
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  profileCard: {
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 18,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarShell: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  identityWrap: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  document: {
    fontSize: 15,
    fontWeight: "700",
  },
  divider: {
    height: 1,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  metaItem: {
    width: "47%",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metaItemFull: {
    width: "100%",
  },
  metaIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  metaCopy: {
    flex: 1,
    gap: 2,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 2,
  },
  sectionRows: {
    gap: 9,
  },
  settingRow: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  rowSubtitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  sessionBlock: {
    gap: 10,
    marginTop: 6,
  },
});
