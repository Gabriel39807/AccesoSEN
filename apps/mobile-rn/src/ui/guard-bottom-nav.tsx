import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";

import { uiTheme } from "./modern";

type NavItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: "/guard/home" | "/guard/historial" | "/guard/alertas";
};

const sideItems: NavItem[] = [
  { label: "Inicio", icon: "grid-outline", path: "/guard/home" },
  { label: "Historial", icon: "time-outline", path: "/guard/historial" },
  { label: "Alertas", icon: "notifications-outline", path: "/guard/alertas" },
];

function activeIcon(icon: keyof typeof Ionicons.glyphMap) {
  return icon.replace("-outline", "") as keyof typeof Ionicons.glyphMap;
}

async function tapFeedback(kind: "primary" | "secondary") {
  try {
    if (kind === "primary") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }
    await Haptics.selectionAsync();
  } catch {
    // Ignore unsupported haptics.
  }
}

function NavPill({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Pressable
      onPress={() => {
        void tapFeedback("secondary");
        router.replace(item.path as any);
      }}
      style={({ pressed }) => [styles.navPill, active ? styles.navPillActive : null, pressed ? styles.navPressed : null]}
    >
      <Ionicons name={active ? activeIcon(item.icon) : item.icon} size={20} color={active ? uiTheme.accentDeep : uiTheme.muted} />
      <Text style={[styles.navLabel, active ? styles.navLabelActive : null]}>{item.label}</Text>
    </Pressable>
  );
}

export function GuardBottomNav() {
  const pathname = usePathname();

  return (
    <View style={styles.wrapper}>
      <View style={styles.shell}>
        <View style={styles.sideGroupLeft}>
          <NavPill item={sideItems[0]} active={pathname === sideItems[0].path} />
          <NavPill item={sideItems[1]} active={pathname === sideItems[1].path} />
        </View>

        <View style={styles.centerGap} />

        <View style={styles.sideGroupRight}>
          <NavPill item={sideItems[2]} active={pathname === sideItems[2].path} />
        </View>
      </View>

      <Pressable
        onPress={() => {
          void tapFeedback("primary");
          router.replace("/guard/scan" as any);
        }}
        style={({ pressed }) => [styles.scanButton, pathname === "/guard/scan" ? styles.scanButtonActive : null, pressed ? styles.scanPressed : null]}
      >
        <View style={styles.scanHalo} />
        <View style={styles.scanInnerRing}>
          <Ionicons name={pathname === "/guard/scan" ? "scan" : "scan-outline"} size={30} color="#ffffff" />
        </View>
        <Text style={styles.scanText}>Escanear</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    maxWidth: 560,
    alignItems: "center",
  },
  shell: {
    width: "100%",
    minHeight: 90,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    shadowColor: uiTheme.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  sideGroupLeft: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    width: "40%",
  },
  sideGroupRight: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "flex-end",
    width: "28%",
  },
  centerGap: {
    width: 92,
  },
  navPill: {
    minWidth: 76,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "transparent",
  },
  navPillActive: {
    backgroundColor: "rgba(15,118,110,0.1)",
  },
  navPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  navLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: uiTheme.muted,
  },
  navLabelActive: {
    color: uiTheme.accentDeep,
  },
  scanButton: {
    position: "absolute",
    top: -30,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  scanButtonActive: {
    transform: [{ translateY: -3 }],
  },
  scanPressed: {
    opacity: 0.97,
    transform: [{ scale: 0.985 }],
  },
  scanHalo: {
    position: "absolute",
    top: -2,
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "rgba(15,118,110,0.12)",
  },
  scanInnerRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: uiTheme.accent,
    borderWidth: 8,
    borderColor: "rgba(237,244,245,0.96)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: uiTheme.accent,
    shadowOpacity: 0.34,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  scanText: {
    color: uiTheme.ink,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
});
