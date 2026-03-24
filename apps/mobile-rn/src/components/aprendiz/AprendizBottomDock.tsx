import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useResolvedThemeMode } from "../../store/preferences";

type AprendizTab = "inicio" | "mi-qr" | "perfil";

const dockThemes = {
  light: {
    navBase: ["rgba(255,255,255,0.97)", "rgba(244,249,255,0.97)"] as [string, string],
    navBorder: "rgba(107, 181, 228, 0.14)",
    navText: "rgba(32, 74, 110, 0.72)",
    navTextActive: "#12345f",
    bubbleBorder: "rgba(255,255,255,0.84)",
    bubbleGlow: "rgba(41, 170, 232, 0.24)",
    ctaGradient: ["#23b6f6", "#0b89d1"] as [string, string],
    shadowColor: "rgba(138, 187, 227, 0.20)",
    divider: "rgba(255,255,255,0.84)",
  },
  dark: {
    navBase: ["rgba(7,17,28,0.96)", "rgba(10,22,36,0.96)"] as [string, string],
    navBorder: "rgba(84, 187, 255, 0.16)",
    navText: "rgba(214, 236, 248, 0.66)",
    navTextActive: "#ffffff",
    bubbleBorder: "rgba(109, 214, 255, 0.38)",
    bubbleGlow: "rgba(27, 178, 232, 0.30)",
    ctaGradient: ["#23b6f6", "#0b89d1"] as [string, string],
    shadowColor: "rgba(0,0,0,0.30)",
    divider: "rgba(146, 209, 255, 0.18)",
  },
};

export default function AprendizBottomDock({ active }: { active: AprendizTab }) {
  const mode = useResolvedThemeMode();
  const theme = dockThemes[mode];

  return (
    <View style={styles.navDockOuter}>
      <LinearGradient
        colors={theme.navBase}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.navDock,
          {
            borderColor: theme.navBorder,
            shadowColor: theme.shadowColor,
            shadowOpacity: mode === "light" ? 0.2 : 0.15,
            shadowRadius: mode === "light" ? 16 : 14,
            shadowOffset: { width: 0, height: mode === "light" ? 9 : 8 },
          },
        ]}
      >
        <View style={styles.dividerWrap}>
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
        </View>

        <View style={styles.tabGrid}>
          <TabButton icon="home" label="Inicio" active={active === "inicio"} onPress={() => router.replace("/aprendiz/home" as any)} mode={mode} />

          <View style={[styles.centerSlot, active === "mi-qr" ? styles.centerSlotActive : null]}>
            <Pressable onPress={() => router.push("/aprendiz/mi-qr" as any)} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
              <LinearGradient
                colors={theme.ctaGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.centerBubble,
                  {
                    borderColor: active === "mi-qr" ? theme.navTextActive : theme.bubbleBorder,
                    shadowColor: theme.bubbleGlow,
                    shadowOpacity: active === "mi-qr" ? 0.34 : 0.26,
                  },
                ]}
              >
                <Ionicons name="qr-code-outline" size={24} color="#ffffff" />
              </LinearGradient>
            </Pressable>
            <Text style={[styles.centerLabel, { color: active === "mi-qr" ? theme.navTextActive : theme.navText }]}>Mi QR</Text>
          </View>

          <TabButton icon="person-outline" label="Perfil" active={active === "perfil"} onPress={() => router.push("/aprendiz/perfil" as any)} mode={mode} />
        </View>
      </LinearGradient>
    </View>
  );
}

function TabButton({
  icon,
  label,
  onPress,
  active,
  mode,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active: boolean;
  mode: "light" | "dark";
}) {
  const theme = dockThemes[mode];

  return (
    <Pressable style={styles.tabSlot} onPress={onPress}>
      <Ionicons name={icon} size={22} color={active ? theme.navTextActive : theme.navText} />
      <Text style={[styles.tabLabel, { color: active ? theme.navTextActive : theme.navText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  navDockOuter: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 10,
    borderRadius: 26,
  },
  navDock: {
    borderRadius: 26,
    borderWidth: 1,
    minHeight: 84,
    position: "relative",
    overflow: "visible",
  },
  dividerWrap: {
    position: "absolute",
    top: 0,
    left: 18,
    right: 18,
    alignItems: "center",
  },
  divider: {
    width: "100%",
    height: 1,
  },
  tabGrid: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 7,
  },
  tabSlot: {
    width: "28%",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    paddingBottom: 7,
  },
  tabLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    textAlign: "center",
  },
  centerSlot: {
    width: "30%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  centerSlotActive: {
    transform: [{ translateY: -1 }],
  },
  centerBubble: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
  },
  centerLabel: {
    marginTop: 4,
    fontSize: 9.5,
    fontWeight: "800",
    textAlign: "center",
  },
});
