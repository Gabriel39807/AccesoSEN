import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSessionStore } from "../../src/store/session";
import { ModernButton } from "../../src/ui/modern";
import { useResolvedThemeMode } from "../../src/store/preferences";
import { guardHomeThemes, GuardThemeMode } from "../../src/components/guard/GuardHomeSections";

export default function TurnoFinalizado() {
  const signOut = useSessionStore((s) => s.signOut);
  const insets = useSafeAreaInsets();
  const mode = useResolvedThemeMode() as GuardThemeMode;
  const theme = guardHomeThemes[mode];
  const isDark = mode === "dark";

  return (
    <View style={[styles.root, { backgroundColor: theme.background[0] }]}>
      <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={isDark ? ["rgba(92,161,255,0.14)", "rgba(92,161,255,0.03)", "transparent"] : ["rgba(129,176,255,0.14)", "rgba(129,176,255,0.03)", "rgba(255,255,255,0.02)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.ambientTop}
      />
      <LinearGradient
        colors={isDark ? ["transparent", "rgba(29,107,201,0.08)", "transparent"] : ["transparent", "rgba(191,220,255,0.14)", "rgba(255,255,255,0.04)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ambientBeam}
      />
      <LinearGradient
        colors={isDark ? ["transparent", "rgba(74,146,239,0.06)", "rgba(74,146,239,0.01)"] : ["rgba(255,255,255,0.02)", "rgba(207,230,255,0.16)", "rgba(239,246,255,0.20)"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.ambientBottom}
      />
      <View style={[styles.content, { paddingTop: insets.top + 18, paddingBottom: Math.max(insets.bottom, 12) + 30 }]}>
        <View style={[styles.successCard, { backgroundColor: theme.sectionBg, borderColor: theme.cardBorder, shadowColor: isDark ? theme.accentGlow : "rgba(120, 158, 224, 0.18)" }]}>
          <View style={[styles.successOrb, { backgroundColor: isDark ? "rgba(77,226,173,0.14)" : "rgba(17,132,94,0.10)", borderColor: theme.cardBorder }]}>
            <Ionicons name="checkmark-done-circle" size={54} color={theme.success} />
          </View>

          <View style={styles.successCopy}>
            <Text style={[styles.kicker, { color: theme.textSoft }]}>TURNO FINALIZADO</Text>
            <Text style={[styles.title, { color: theme.text }]}>Cierre exitoso</Text>
            <Text style={[styles.subtitle, { color: theme.textSoft }]}>
              El turno del guarda fue finalizado correctamente. Gracias por completar el control operativo del acceso.
            </Text>
          </View>

          <View style={[styles.highlightRow, { backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.56)", borderColor: theme.summaryBorder }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.accent} />
            <Text style={[styles.highlightText, { color: theme.textMuted }]}>
              Ya puedes volver al inicio para comenzar una nueva sesion cuando sea necesario.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <ModernButton
            label="Volver al inicio"
            icon="home-outline"
            tone="guard"
            onPress={async () => {
              await signOut();
              router.replace("/");
            }}
          />
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
    bottom: 40,
    height: 260,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: "space-between",
    gap: 24,
  },
  successCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  successOrb: {
    width: 112,
    height: 112,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  successCopy: {
    alignItems: "center",
    gap: 8,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 320,
  },
  highlightRow: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  highlightText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  actions: {
    gap: 10,
  },
});
