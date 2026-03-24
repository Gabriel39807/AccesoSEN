import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GuardThemeMode, guardHomeThemes } from "../../src/components/guard/GuardHomeSections";
import { useResolvedThemeMode } from "../../src/store/preferences";
import { useSessionStore } from "../../src/store/session";

export default function GuardInfoScreen() {
  const insets = useSafeAreaInsets();
  const user = useSessionStore((s) => s.user);
  const turno = useSessionStore((s) => s.turno);
  const mode = useResolvedThemeMode() as GuardThemeMode;
  const theme = guardHomeThemes[mode];

  const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.username || "Guarda";

  const details = [
    { label: "Nombre completo", value: fullName, icon: "person-outline" as const },
    { label: "Identificacion", value: user?.documento || "-", icon: "id-card-outline" as const },
    { label: "Sede", value: String(turno?.sede ?? user?.sede_principal ?? "-"), icon: "business-outline" as const },
    { label: "Turno", value: String(turno?.jornada ?? "-"), icon: "time-outline" as const },
    { label: "Estado", value: turno?.id ? "En servicio" : "Sin turno", icon: "shield-checkmark-outline" as const },
    { label: "Telefono", value: user?.telefono || "Sin telefono registrado", icon: "call-outline" as const },
    { label: "Correo electronico", value: user?.email || "Sin correo registrado", icon: "mail-outline" as const },
    { label: "Usuario", value: user?.username || "-", icon: "at-outline" as const },
  ];

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
            <Text style={[styles.title, { color: theme.text }]}>Informacion del guarda</Text>
            <Text style={[styles.subtitle, { color: theme.textSoft }]}>Consulta la ficha completa y los datos de contacto del perfil.</Text>
          </View>
        </View>

        <View style={[styles.heroCard, { backgroundColor: theme.sectionBg, borderColor: theme.summaryBorder }]}>
          <View style={[styles.avatarWrap, { backgroundColor: mode === "dark" ? "rgba(89,185,255,0.10)" : "rgba(45,104,216,0.08)", borderColor: theme.cardBorder }]}>
            <Ionicons name="shield-outline" size={26} color={theme.accent} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.heroName, { color: theme.text }]}>{fullName}</Text>
            <Text style={[styles.heroMeta, { color: theme.textMuted }]}>Guarda asignado al modulo operativo</Text>
          </View>
        </View>

        <View style={[styles.detailCard, { backgroundColor: theme.sectionBg, borderColor: theme.summaryBorder }]}>
          {details.map((item) => (
            <View key={item.label} style={[styles.detailRow, { borderBottomColor: theme.divider }]}>
              <View style={[styles.detailIconWrap, { backgroundColor: mode === "dark" ? "rgba(89,185,255,0.10)" : "rgba(45,104,216,0.08)" }]}>
                <Ionicons name={item.icon} size={18} color={theme.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.detailLabel, { color: theme.textSoft }]}>{item.label}</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
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
  heroCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroName: {
    fontSize: 20,
    fontWeight: "900",
  },
  heroMeta: {
    fontSize: 13,
    fontWeight: "600",
  },
  detailCard: {
    borderRadius: 26,
    borderWidth: 1,
    overflow: "hidden",
  },
  detailRow: {
    minHeight: 76,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  detailValue: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
  },
});
