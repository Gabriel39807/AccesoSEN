import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Switch,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import GuardBottomDock from "../../src/components/guard/GuardBottomDock";
import { GuardThemeMode, guardHomeThemes, ThemeToggle } from "../../src/components/guard/GuardHomeSections";
import { usePreferencesStore, useResolvedThemeMode } from "../../src/store/preferences";
import { useSessionStore } from "../../src/store/session";

export default function GuardAjustes() {
  const user = useSessionStore((s) => s.user);
  const turno = useSessionStore((s) => s.turno);
  const signOut = useSessionStore((s) => s.signOut);
  const insets = useSafeAreaInsets();
  const [closingSession, setClosingSession] = useState(false);
  const mode = useResolvedThemeMode() as GuardThemeMode;
  const toggleThemeMode = usePreferencesStore((s) => s.toggleThemeMode);
  const notifications = usePreferencesStore((s) => s.notifications);
  const setNotificationPreference = usePreferencesStore((s) => s.setNotificationPreference);

  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, translate]);

  const theme = guardHomeThemes[mode];

  const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.username || "Guarda";
  const identificacion = user?.documento || "Sin documento";
  const sede = String(turno?.sede ?? user?.sede_principal ?? "Sin sede");
  const jornada = String(turno?.jornada ?? "Sin turno");
  const statusLabel = turno?.id ? "En servicio" : "Sin turno";

  const onInfo = () => {
    router.push("/guard/info-guarda" as any);
  };

  const onThemeToggle = () => {
    toggleThemeMode();
  };

  const onSignOut = async () => {
    try {
      setClosingSession(true);
      await signOut();
      router.replace("/auth/login" as any);
    } finally {
      setClosingSession(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background[0] }]}>
      <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={mode === "dark" ? ["rgba(92,161,255,0.14)", "rgba(92,161,255,0.03)", "transparent"] : ["rgba(129,176,255,0.14)", "rgba(129,176,255,0.03)", "rgba(255,255,255,0.02)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.ambientTop}
      />
      <LinearGradient
        colors={mode === "dark" ? ["transparent", "rgba(29,107,201,0.08)", "transparent"] : ["transparent", "rgba(191,220,255,0.16)", "rgba(255,255,255,0.04)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ambientBeam}
      />
      <LinearGradient
        colors={mode === "dark" ? ["transparent", "rgba(74,146,239,0.06)", "rgba(74,146,239,0.01)"] : ["rgba(255,255,255,0.02)", "rgba(207,230,255,0.18)", "rgba(239,246,255,0.22)"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.ambientBottom}
      />
      <Animated.View style={[styles.flex, { opacity: fade, transform: [{ translateY: translate }] }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 12) + 10,
              paddingBottom: 152 + Math.max(insets.bottom, 8),
            },
          ]}
        >
          <View style={styles.headerTopRow}>
            <View style={styles.headerCopy}>
              <Text style={[styles.screenTitle, { color: theme.text }]}>Ajustes</Text>
              <Text style={[styles.screenSubtitle, { color: theme.textSoft }]}>Configura tu cuenta y preferencias</Text>
            </View>
          </View>

          <View
            style={[
              styles.userCard,
              {
                backgroundColor: theme.sectionBg,
                borderColor: theme.summaryBorder,
                shadowColor: mode === "light" ? "rgba(132, 167, 231, 0.16)" : theme.accentGlow,
              },
            ]}
          >
            {mode === "light" ? <View style={styles.userCardSheen} /> : null}
            <View style={styles.userTopRow}>
              <View style={[styles.avatarOrb, { backgroundColor: mode === "dark" ? "rgba(89,185,255,0.10)" : "rgba(45,104,216,0.08)", borderColor: theme.cardBorder }]}>
                <Ionicons name="shield-checkmark-outline" size={24} color={theme.accent} />
              </View>
              <View style={styles.userCopy}>
                <Text style={[styles.userName, { color: theme.text }]}>{fullName}</Text>
                <Text style={[styles.userMetaLine, { color: theme.textMuted }]}>Identificacion: {identificacion}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: mode === "dark" ? "rgba(77,226,173,0.12)" : "rgba(17,132,94,0.10)" }]}>
                <Text style={[styles.statusText, { color: theme.success }]}>{statusLabel}</Text>
              </View>
            </View>

            <View style={styles.userInfoGrid}>
              <CompactInfo label="Sede" value={sede} icon="business-outline" theme={theme} />
              <CompactInfo label="Turno" value={jornada} icon="time-outline" theme={theme} />
            </View>
          </View>

          <SettingsSection title="Cuenta" theme={theme}>
            <SettingsRow
              icon="id-card-outline"
              title="Informacion del guarda"
              subtitle="Ficha completa del guarda y datos de contacto"
              theme={theme}
              onPress={onInfo}
            />
          </SettingsSection>

          <SettingsSection title="Preferencias" theme={theme}>
            <SettingsRow
              icon="notifications-outline"
              title="Notificaciones"
              subtitle="Define avisos operativos y preferencias del dispositivo"
              theme={theme}
              onPress={() => router.push("/guard/notificaciones" as any)}
            />
            <SettingsToggleRow
              icon={mode === "dark" ? "moon-outline" : "sunny-outline"}
              title="Tema"
              subtitle={mode === "dark" ? "Modo oscuro activo" : "Modo claro activo"}
              theme={theme}
              toggle={<ThemeToggle theme={theme} mode={mode} onToggle={onThemeToggle} />}
            />
            <SettingsSwitchRow
              icon="notifications-circle-outline"
              title="Avisos activos"
              subtitle="Recibe novedades del modulo de guarda"
              theme={theme}
              value={notifications.enabled}
              onValueChange={(value) => setNotificationPreference("enabled", value)}
            />
          </SettingsSection>

          <SettingsSection title="Sesion" theme={theme}>
            <Pressable
              onPress={onSignOut}
              disabled={closingSession}
              style={({ pressed }) => [
                styles.signOutRow,
                {
                  backgroundColor: mode === "dark" ? "rgba(127,29,29,0.16)" : "rgba(220,38,38,0.08)",
                  borderColor: mode === "dark" ? "rgba(248,113,113,0.20)" : "rgba(239,68,68,0.12)",
                  opacity: pressed || closingSession ? 0.92 : 1,
                },
              ]}
            >
              <View style={[styles.signOutIcon, { backgroundColor: mode === "dark" ? "rgba(248,113,113,0.12)" : "rgba(220,38,38,0.10)" }]}>
                <Ionicons name="log-out-outline" size={18} color={mode === "dark" ? "#fca5a5" : "#dc2626"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.signOutTitle, { color: mode === "dark" ? "#fee2e2" : "#b91c1c" }]}>Cerrar sesion</Text>
                <Text style={[styles.signOutSubtitle, { color: mode === "dark" ? "#fecaca" : "#dc2626" }]}>Finaliza el acceso del guarda en este dispositivo</Text>
              </View>
              {closingSession ? <ActivityIndicator color={mode === "dark" ? "#fecaca" : "#dc2626"} /> : <Ionicons name="chevron-forward" size={18} color={mode === "dark" ? "#fecaca" : "#dc2626"} />}
            </Pressable>
          </SettingsSection>
        </ScrollView>
      </Animated.View>

      <GuardBottomDock active="ajustes" mode={mode} />
    </View>
  );
}

function SettingsSection({
  title,
  theme,
  children,
}: {
  title: string;
  theme: typeof guardHomeThemes.light;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={[styles.sectionTitle, { color: theme.textSoft }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: theme.sectionBg, borderColor: theme.summaryBorder }]}>
        {children}
      </View>
    </View>
  );
}

function SettingsRow({
  icon,
  title,
  subtitle,
  theme,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  theme: typeof guardHomeThemes.light;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.92 }]}>
      <View style={[styles.rowIconWrap, { backgroundColor: theme.mode === "dark" ? "rgba(89,185,255,0.10)" : "rgba(45,104,216,0.08)" }]}>
        <Ionicons name={icon} size={18} color={theme.accent} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: theme.textSoft }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSoft} />
    </Pressable>
  );
}

function SettingsToggleRow({
  icon,
  title,
  subtitle,
  theme,
  toggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  theme: typeof guardHomeThemes.light;
  toggle: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIconWrap, { backgroundColor: theme.mode === "dark" ? "rgba(89,185,255,0.10)" : "rgba(45,104,216,0.08)" }]}>
        <Ionicons name={icon} size={18} color={theme.accent} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: theme.textSoft }]}>{subtitle}</Text>
      </View>
      {toggle}
    </View>
  );
}

function SettingsSwitchRow({
  icon,
  title,
  subtitle,
  theme,
  value,
  onValueChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  theme: typeof guardHomeThemes.light;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIconWrap, { backgroundColor: theme.mode === "dark" ? "rgba(89,185,255,0.10)" : "rgba(45,104,216,0.08)" }]}>
        <Ionicons name={icon} size={18} color={theme.accent} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: theme.textSoft }]}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.mode === "dark" ? "rgba(148,163,184,0.32)" : "rgba(148,163,184,0.35)", true: theme.accentStrong }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

function CompactInfo({
  label,
  value,
  icon,
  theme,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme: typeof guardHomeThemes.light;
}) {
  return (
    <View style={[styles.infoChip, { backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.48)", borderColor: theme.divider }]}>
      <Ionicons name={icon} size={15} color={theme.accent} />
      <Text style={[styles.infoLabel, { color: theme.textSoft }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 18,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  screenSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
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
    top: 116,
    left: -32,
    right: -32,
    height: 280,
    transform: [{ rotate: "-8deg" }],
  },
  ambientBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 108,
    height: 250,
  },
  userCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    gap: 16,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    overflow: "hidden",
  },
  userCardSheen: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  userTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarOrb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  userCopy: {
    flex: 1,
    gap: 3,
  },
  userName: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  userMetaLine: {
    fontSize: 13,
    fontWeight: "600",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  userInfoGrid: {
    flexDirection: "row",
    gap: 10,
  },
  infoChip: {
    flex: 1,
    minHeight: 62,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "space-between",
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  sectionWrap: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 2,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  rowSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  signOutRow: {
    borderWidth: 1,
    borderRadius: 22,
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  signOutIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  signOutSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: 2,
  },
});
