import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useResolvedThemeMode } from "../../src/store/preferences";

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

const faqs = [
  {
    id: "equipos",
    title: "Registra tus equipos antes de ingresar",
    subtitle: "Así el control de acceso será más rápido y evitarás validaciones manuales.",
  },
  {
    id: "clave",
    title: "Si olvidaste tu clave, usa la recuperación",
    subtitle: "El flujo OTP te permite recuperar el acceso sin depender de soporte inmediato.",
  },
  {
    id: "serial",
    title: "Verifica siempre el serial",
    subtitle: "Asegúrate de que coincida con el dispositivo que registraste en tu perfil.",
  },
];

export default function AprendizAyuda() {
  const insets = useSafeAreaInsets();
  const mode = useResolvedThemeMode() as Mode;
  const theme = themes[mode];
  const isDark = mode === "dark";

  return (
    <View style={[styles.root, { backgroundColor: theme.background[0] }]}>
      <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={theme.ambientTop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ambientTop} />
      <LinearGradient colors={theme.ambientBeam} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ambientBeam} />
      <LinearGradient colors={theme.ambientBottom} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.ambientBottom} />
      <View style={[styles.content, { paddingTop: insets.top + 18, paddingBottom: 30 + Math.max(insets.bottom, 8) }]}>
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>Ayuda y soporte</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSoft }]}>Respuestas rápidas y un canal directo de contacto.</Text>
        </View>

        <View style={[styles.faqCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, shadowColor: isDark ? "rgba(0,0,0,0.28)" : "rgba(138, 187, 227, 0.18)" }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Preguntas frecuentes</Text>
          <View style={styles.faqList}>
            {faqs.map((item) => (
              <View key={item.id} style={[styles.faqRow, { backgroundColor: theme.rowBg, borderColor: theme.line }]}>
                <View style={[styles.faqIcon, { backgroundColor: theme.accentSoft }]}>
                  <Ionicons name="help-circle-outline" size={16} color={theme.accentStrong} />
                </View>
                <View style={styles.faqCopy}>
                  <Text style={[styles.faqTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.faqSubtitle, { color: theme.textSoft }]}>{item.subtitle}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.contactCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.contactHeader}>
            <View style={[styles.contactIcon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="mail-outline" size={18} color={theme.accentStrong} />
            </View>
            <View style={styles.contactCopy}>
              <Text style={[styles.contactTitle, { color: theme.text }]}>Contacto de soporte</Text>
              <Text style={[styles.contactSubtitle, { color: theme.textSoft }]}>Escríbenos si necesitas ayuda adicional.</Text>
            </View>
          </View>

          <Pressable onPress={() => Linking.openURL("mailto:soporte@institucion.local")} style={({ pressed }) => [{ opacity: pressed ? 0.76 : 1 }]}>
            <View style={[styles.emailRow, { backgroundColor: theme.rowBg, borderColor: theme.line }]}>
              <Text style={[styles.emailText, { color: theme.text }]}>soporte@institucion.local</Text>
              <Ionicons name="open-outline" size={18} color={theme.accentStrong} />
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
    flex: 1,
    paddingHorizontal: 22,
    gap: 16,
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
  faqCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    gap: 14,
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  faqList: {
    gap: 10,
  },
  faqRow: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 10,
  },
  faqIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  faqCopy: {
    flex: 1,
    gap: 3,
  },
  faqTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  faqSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  contactCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  contactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  contactCopy: {
    flex: 1,
    gap: 2,
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  contactSubtitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  emailRow: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  emailText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
