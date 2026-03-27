import React, { useEffect, useRef } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSessionStore } from "../src/store/session";
import { usePreferencesStore, useResolvedThemeMode } from "../src/store/preferences";

const SADI_LOGO_LIGHT = require("../assets/images/sadi-logo-light.png");
const SADI_LOGO_DARK = require("../assets/images/sadi-logo-dark.png");

type Mode = "light" | "dark";

const themes = {
  light: {
    background: ["#fbfdff", "#f2f7ff", "#e7efff"] as [string, string, string],
    ambientTop: ["rgba(116,156,236,0.12)", "rgba(116,156,236,0.03)", "transparent"] as [string, string, string],
    ambientBeam: ["transparent", "rgba(193,218,255,0.14)", "rgba(255,255,255,0.04)"] as [string, string, string],
    ambientBottom: ["rgba(255,255,255,0.02)", "rgba(224,236,255,0.18)", "rgba(244,248,255,0.22)"] as [string, string, string],
    text: "#122544",
    textMuted: "#4e6686",
    textSoft: "#7589a6",
    panelBg: "rgba(255,255,255,0.72)",
    panelBorder: "rgba(110, 152, 222, 0.16)",
    panelShadow: "rgba(137, 172, 231, 0.16)",
    panelEdge: "rgba(255,255,255,0.84)",
    iconTint: "#274266",
    footer: "#7184a0",
    toggleBg: "rgba(255,255,255,0.62)",
    toggleBorder: "rgba(110, 152, 222, 0.14)",
    toggleThumb: "#ffffff",
    brandGlow: "rgba(119, 162, 231, 0.18)",
    guardBtn: ["#3b82f6", "#1d4ed8"] as [string, string],
    aprendizBtn: ["#22b3f4", "#0b89d1"] as [string, string],
  },
  dark: {
    background: ["#07111d", "#0a1a30", "#102a44"] as [string, string, string],
    ambientTop: ["rgba(89,185,255,0.14)", "rgba(89,185,255,0.03)", "transparent"] as [string, string, string],
    ambientBeam: ["transparent", "rgba(25,112,201,0.10)", "transparent"] as [string, string, string],
    ambientBottom: ["transparent", "rgba(45,135,230,0.08)", "rgba(45,135,230,0.02)"] as [string, string, string],
    text: "#f8fbff",
    textMuted: "#d4e1f6",
    textSoft: "#94a7c5",
    panelBg: "rgba(10,19,34,0.66)",
    panelBorder: "rgba(96,151,232,0.16)",
    panelShadow: "rgba(0,0,0,0.30)",
    panelEdge: "rgba(255,255,255,0.08)",
    iconTint: "#87b7de",
    footer: "#8ea2c1",
    toggleBg: "rgba(255,255,255,0.05)",
    toggleBorder: "rgba(96,151,232,0.16)",
    toggleThumb: "#0f2137",
    brandGlow: "rgba(0, 0, 0, 0.28)",
    guardBtn: ["#3b82f6", "#1d4ed8"] as [string, string],
    aprendizBtn: ["#23b6f6", "#0b89d1"] as [string, string],
  },
};

const PATTERN_ITEMS: { icon: keyof typeof Ionicons.glyphMap; top: string; left: string; size: number; opacity: number }[] = [
  { icon: "shield-outline", top: "11%", left: "10%", size: 22, opacity: 0.09 },
  { icon: "scan-outline", top: "13%", left: "77%", size: 23, opacity: 0.09 },
  { icon: "id-card-outline", top: "23%", left: "18%", size: 21, opacity: 0.06 },
  { icon: "qr-code-outline", top: "24%", left: "64%", size: 28, opacity: 0.09 },
  { icon: "person-outline", top: "32%", left: "84%", size: 20, opacity: 0.06 },
  { icon: "school-outline", top: "42%", left: "11%", size: 23, opacity: 0.07 },
  { icon: "shield-checkmark-outline", top: "46%", left: "60%", size: 19, opacity: 0.07 },
  { icon: "cube-outline", top: "57%", left: "80%", size: 18, opacity: 0.07 },
  { icon: "time-outline", top: "63%", left: "16%", size: 17, opacity: 0.06 },
  { icon: "help-circle-outline", top: "72%", left: "39%", size: 19, opacity: 0.07 },
  { icon: "reader-outline", top: "81%", left: "81%", size: 19, opacity: 0.06 },
  { icon: "document-text-outline", top: "85%", left: "18%", size: 18, opacity: 0.06 },
];

function AmbientPattern({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 10000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 10000, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateY }] }]}>
      {PATTERN_ITEMS.map((item, index) => (
        <Ionicons
          key={`${item.icon}-${index}`}
          name={item.icon}
          size={item.size}
          color={color}
          style={{ position: "absolute", top: item.top as any, left: item.left as any, opacity: item.opacity }}
        />
      ))}
    </Animated.View>
  );
}

function ThemeToggle({
  mode,
  onToggle,
  colors,
}: {
  mode: Mode;
  onToggle: () => void;
  colors: { bg: string; border: string; thumb: string; text: string };
}) {
  const isDark = mode === "dark";

  return (
    <Pressable onPress={onToggle}>
      {({ pressed }) => (
        <View
          style={[
            styles.themeToggle,
            {
              backgroundColor: colors.bg,
              borderColor: colors.border,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <View style={styles.themeIcons}>
            <Ionicons name="sunny-outline" size={13} color={colors.text} />
            <Ionicons name="moon-outline" size={13} color={colors.text} />
          </View>
          <View
            style={[
              styles.themeThumb,
              {
                backgroundColor: colors.thumb,
                transform: [{ translateX: isDark ? 21 : 0 }],
              },
            ]}
          >
            <Ionicons name={isDark ? "moon" : "sunny"} size={11} color={isDark ? "#ffffff" : "#2d68d8"} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

function RoleButton({
  icon,
  title,
  subtitle,
  colors,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  colors: [string, string];
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.roleButton, { opacity: pressed ? 0.95 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
          <View style={styles.roleIconWrap}>
            <Ionicons name={icon} size={20} color="#ffffff" />
          </View>
          <View style={styles.roleCopy}>
            <Text style={styles.roleTitle}>{title}</Text>
            <Text style={styles.roleSubtitle}>{subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.92)" />
        </LinearGradient>
      )}
    </Pressable>
  );
}

export default function RoleSelection() {
  const user = useSessionStore((s) => s.user);
  const mode = useResolvedThemeMode() as Mode;
  const theme = themes[mode];
  const logoSource = mode === "dark" ? SADI_LOGO_LIGHT : SADI_LOGO_DARK;
  const toggleThemeMode = usePreferencesStore((s) => s.toggleThemeMode);
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(220)).current;

  useEffect(() => {
    if (user?.rol === "guarda") router.replace({ pathname: "/guard/home" } as any);
    if (user?.rol === "aprendiz") {
      if (user?.must_change_password) router.replace({ pathname: "/auth/first-password" } as any);
      else router.replace({ pathname: "/aprendiz/home" } as any);
    }
  }, [user]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 54,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background[0] }]}>
      <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={theme.ambientTop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ambientTop} />
      <LinearGradient colors={theme.ambientBeam} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ambientBeam} />
      <LinearGradient colors={theme.ambientBottom} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.ambientBottom} />
      <LinearGradient
        colors={mode === "dark" ? ["rgba(54,126,214,0.10)", "rgba(54,126,214,0.02)", "transparent"] : ["rgba(190,220,255,0.34)", "rgba(190,220,255,0.04)", "transparent"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.logoAmbient}
      />
      <AmbientPattern color={theme.iconTint} />

      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <ThemeToggle
          mode={mode}
          onToggle={toggleThemeMode}
          colors={{
            bg: theme.toggleBg,
            border: theme.toggleBorder,
            thumb: theme.toggleThumb,
            text: theme.text,
          }}
        />
      </View>

      <View style={styles.heroArea}>
        <View
          style={[
            styles.logoWrap,
            {
              shadowColor: theme.brandGlow,
            },
          ]}
        >
          <Image source={logoSource} style={styles.logoImage} resizeMode="contain" />
        </View>
      </View>

      <Animated.View style={[styles.panelWrap, { transform: [{ translateY: slideAnim }] }]}>
        <View
          style={[
            styles.panel,
            {
              backgroundColor: theme.panelBg,
              borderColor: theme.panelBorder,
              shadowColor: theme.panelShadow,
            },
          ]}
        >
          <View style={[styles.panelSheen, { backgroundColor: theme.panelEdge }]} />
          <Text style={[styles.welcomeTitle, { color: theme.text }]}>Bienvenido a SADI.</Text>
          <Text style={[styles.welcomeSubtitle, { color: theme.textSoft }]}>Selecciona tu perfil para ingresar al sistema.</Text>

          <View style={styles.roleButtons}>
            <RoleButton
              icon="shield-checkmark"
              title="Personal de Seguridad"
              subtitle="Control y validacion"
              colors={theme.guardBtn}
              onPress={() => router.push({ pathname: "/auth/login", params: { rol: "guarda" } } as any)}
            />
            <RoleButton
              icon="school"
              title="Aprendiz"
              subtitle="Credencial y acceso"
              colors={theme.aprendizBtn}
              onPress={() => router.push({ pathname: "/auth/login", params: { rol: "aprendiz" } } as any)}
            />
          </View>

          <View style={styles.footerRow}>
            <Ionicons name="lock-closed" size={11} color={theme.footer} style={{ marginRight: 6 }} />
            <Text style={[styles.footerText, { color: theme.footer }]}>Asegurado por SADI 2026</Text>
          </View>
        </View>
      </Animated.View>
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
    height: 300,
    transform: [{ rotate: "-8deg" }],
  },
  ambientBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
  },
  logoAmbient: {
    position: "absolute",
    top: 64,
    left: 18,
    right: 18,
    height: 300,
  },
  topBar: {
    position: "absolute",
    top: 0,
    right: 18,
    zIndex: 5,
  },
  themeToggle: {
    width: 54,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  themeIcons: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  themeThumb: {
    position: "absolute",
    left: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  heroArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 108,
    paddingTop: 76,
    position: "relative",
  },
  logoWrap: {
    width: 154,
    height: 154,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  panelWrap: {
    justifyContent: "flex-end",
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  panel: {
    overflow: "hidden",
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  panelSheen: {
    position: "absolute",
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    opacity: 0.8,
  },
  welcomeTitle: {
    fontSize: 29,
    lineHeight: 34,
    textAlign: "center",
    letterSpacing: -0.8,
    fontWeight: "900",
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 22,
    paddingHorizontal: 10,
  },
  roleButtons: {
    gap: 12,
  },
  roleButton: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "rgba(0,0,0,0.20)",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  },
  roleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  roleCopy: {
    flex: 1,
    gap: 2,
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
  },
  roleSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.84)",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    opacity: 0.72,
  },
  footerText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
