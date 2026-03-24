import React from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GuardThemeMode, guardHomeThemes } from "../../src/components/guard/GuardHomeSections";
import { usePreferencesStore, useResolvedThemeMode } from "../../src/store/preferences";

export default function GuardNotificationSettings() {
  const insets = useSafeAreaInsets();
  const mode = useResolvedThemeMode() as GuardThemeMode;
  const theme = guardHomeThemes[mode];
  const notifications = usePreferencesStore((s) => s.notifications);
  const setNotificationPreference = usePreferencesStore((s) => s.setNotificationPreference);

  return (
    <View style={[styles.root, { backgroundColor: theme.background[0] }]}>
      <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 16) + 6, paddingBottom: 32 }]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: theme.sectionBg, borderColor: theme.summaryBorder }]}>
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: theme.text }]}>Notificaciones</Text>
            <Text style={[styles.subtitle, { color: theme.textSoft }]}>Configura los avisos del guarda sin mezclarlo con el modulo operativo de alertas.</Text>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: theme.sectionBg, borderColor: theme.summaryBorder }]}>
          <Ionicons name="notifications-outline" size={20} color={theme.accent} />
          <Text style={[styles.infoText, { color: theme.textMuted }]}>Estas preferencias controlan la experiencia del usuario en este dispositivo.</Text>
        </View>

        <View style={[styles.settingsCard, { backgroundColor: theme.sectionBg, borderColor: theme.summaryBorder }]}>
          <NotificationRow
            icon="notifications-circle-outline"
            title="Notificaciones activas"
            subtitle="Permite recibir avisos del modulo de guarda"
            value={notifications.enabled}
            theme={theme}
            onValueChange={(value) => setNotificationPreference("enabled", value)}
          />
          <NotificationRow
            icon="shield-outline"
            title="Avisos operativos"
            subtitle="Recibe novedades relacionadas con turnos y seguridad"
            value={notifications.operativas}
            disabled={!notifications.enabled}
            theme={theme}
            onValueChange={(value) => setNotificationPreference("operativas", value)}
          />
          <NotificationRow
            icon="megaphone-outline"
            title="Novedades generales"
            subtitle="Muestra recordatorios y cambios del sistema"
            value={notifications.novedades}
            disabled={!notifications.enabled}
            theme={theme}
            onValueChange={(value) => setNotificationPreference("novedades", value)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function NotificationRow({
  icon,
  title,
  subtitle,
  value,
  disabled,
  theme,
  onValueChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value: boolean;
  disabled?: boolean;
  theme: typeof guardHomeThemes.light;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={[styles.row, { opacity: disabled ? 0.55 : 1, borderBottomColor: theme.divider }]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.mode === "dark" ? "rgba(89,185,255,0.10)" : "rgba(45,104,216,0.08)" }]}>
        <Ionicons name={icon} size={18} color={theme.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: theme.textSoft }]}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.mode === "dark" ? "rgba(148,163,184,0.32)" : "rgba(148,163,184,0.35)", true: theme.accentStrong }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  infoCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  settingsCard: {
    borderRadius: 26,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    minHeight: 80,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
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
});
