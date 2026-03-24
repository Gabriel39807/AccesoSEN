import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { GuardThemeMode, guardHomeThemes } from "./GuardHomeSections";

type Tab = "inicio" | "reportes" | "scan" | "alertas" | "ajustes";

export default function GuardBottomDock({
  active,
  mode = "light",
}: {
  active: Tab;
  mode?: GuardThemeMode;
}) {
  const theme = guardHomeThemes[mode];

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
            shadowColor: mode === "light" ? "rgba(138, 171, 232, 0.18)" : "rgba(0,0,0,0.35)",
            shadowOpacity: mode === "light" ? 0.22 : 0.16,
            shadowRadius: mode === "light" ? 18 : 16,
            shadowOffset: { width: 0, height: mode === "light" ? 10 : 8 },
          },
        ]}
      >
        <View style={styles.topDividerWrap}>
          <View style={[styles.topDivider, { backgroundColor: theme.mode === "dark" ? "rgba(145, 189, 255, 0.22)" : "rgba(255,255,255,0.9)" }]} />
        </View>

        <View style={styles.tabsRow}>
          <TabButton
            icon="home"
            label="Inicio"
            active={active === "inicio"}
            onPress={() => router.replace("/guard/home" as any)}
            mode={mode}
          />
          <TabButton
            icon="bar-chart-outline"
            label="Reportes"
            active={active === "reportes"}
            onPress={() => router.push("/guard/historial" as any)}
            mode={mode}
          />

          <View style={styles.centerSlot}>
            <View style={styles.centerIconPlaceholder} />
          </View>

          <TabButton
            icon="notifications-outline"
            label="Alertas"
            active={active === "alertas"}
            withDot
            onPress={() => router.push("/guard/alertas" as any)}
            mode={mode}
          />
          <TabButton
            icon="settings-outline"
            label="Ajustes"
            active={active === "ajustes"}
            onPress={() => router.push("/guard/ajustes" as any)}
            mode={mode}
          />
        </View>

        <View style={styles.centerBubbleWrap} pointerEvents="box-none">
          <Pressable onPress={() => router.push("/guard/scan" as any)} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
            <LinearGradient
              colors={theme.ctaGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.centerBubble,
                {
                  borderColor: active === "scan" ? theme.navTextActive : theme.bubbleBorder,
                  shadowColor: theme.bubbleGlow,
                  shadowOpacity: active === "scan" ? 0.4 : 0.32,
                  transform: [{ scale: active === "scan" ? 1.02 : 1 }],
                },
              ]}
            >
              <Ionicons name="qr-code-outline" size={28} color="#ffffff" />
            </LinearGradient>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

function TabButton({
  icon,
  label,
  onPress,
  active = false,
  withDot = false,
  mode,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  withDot?: boolean;
  mode: GuardThemeMode;
}) {
  const theme = guardHomeThemes[mode];

  return (
    <Pressable style={styles.tabSlot} onPress={onPress}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={23} color={active ? theme.navTextActive : theme.navText} />
        {withDot ? <View style={[styles.alertDot, { backgroundColor: "#f59e0b", shadowColor: theme.mode === "dark" ? "#f59e0b" : "transparent" }]} /> : null}
      </View>
      <Text style={[styles.tabLabel, { color: active ? theme.navTextActive : theme.navText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  navDockOuter: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 10,
    borderRadius: 30,
  },
  navDock: {
    borderRadius: 30,
    borderWidth: 1,
    minHeight: 102,
    position: "relative",
    overflow: "visible",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  topDividerWrap: {
    position: "absolute",
    top: 0,
    left: 18,
    right: 18,
    alignItems: "center",
  },
  topDivider: {
    width: "100%",
    height: 1,
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 22,
    paddingBottom: 10,
  },
  tabSlot: {
    width: "20%",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 10,
  },
  iconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 24,
  },
  tabLabel: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  centerSlot: {
    width: "20%",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 6,
  },
  centerIconPlaceholder: {
    height: 56,
  },
  centerBubbleWrap: {
    position: "absolute",
    left: "50%",
    top: -6,
    transform: [{ translateX: -34 }],
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
  },
  centerBubble: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  alertDot: {
    position: "absolute",
    right: -2,
    top: 0,
    width: 7,
    height: 7,
    borderRadius: 4,
    shadowOpacity: 0.7,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});
