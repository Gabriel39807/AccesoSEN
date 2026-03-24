import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export type GuardThemeMode = "light" | "dark";

export type GuardHomeTheme = {
  mode: GuardThemeMode;
  background: [string, string, string];
  text: string;
  textMuted: string;
  textSoft: string;
  accent: string;
  accentStrong: string;
  accentGlow: string;
  cardBorder: string;
  cardBg: string;
  sectionBg: string;
  summaryBorder: string;
  divider: string;
  success: string;
  warning: string;
  navBase: [string, string];
  navBorder: string;
  navText: string;
  navTextActive: string;
  bubbleBorder: string;
  bubbleGlow: string;
  ctaText: string;
  ctaGradient: [string, string];
};

export const guardHomeThemes: Record<GuardThemeMode, GuardHomeTheme> = {
  light: {
    mode: "light",
    background: ["#fbfdff", "#f0f5ff", "#e6eeff"],
    text: "#16315f",
    textMuted: "#456391",
    textSoft: "#7488ad",
    accent: "#2d68d8",
    accentStrong: "#1e4fb0",
    accentGlow: "rgba(62, 125, 242, 0.16)",
    cardBorder: "rgba(75, 135, 226, 0.20)",
    cardBg: "rgba(255,255,255,0.76)",
    sectionBg: "rgba(255,255,255,0.84)",
    summaryBorder: "rgba(111, 157, 231, 0.14)",
    divider: "rgba(89, 131, 201, 0.10)",
    success: "#11845e",
    warning: "#b42318",
    navBase: ["rgba(255,255,255,0.96)", "rgba(246,249,255,0.96)"],
    navBorder: "rgba(110, 152, 222, 0.14)",
    navText: "rgba(35, 61, 112, 0.72)",
    navTextActive: "#17356a",
    bubbleBorder: "rgba(255,255,255,0.8)",
    bubbleGlow: "rgba(60, 120, 235, 0.24)",
    ctaText: "#ffffff",
    ctaGradient: ["#3b82f6", "#1d4ed8"],
  },
  dark: {
    mode: "dark",
    background: ["#07101e", "#0a1830", "#0f2745"],
    text: "#f8fbff",
    textMuted: "#d2def6",
    textSoft: "#95a6c6",
    accent: "#59b9ff",
    accentStrong: "#1c8cff",
    accentGlow: "rgba(52, 170, 255, 0.24)",
    cardBorder: "rgba(77, 177, 255, 0.34)",
    cardBg: "rgba(15, 26, 43, 0.52)",
    sectionBg: "rgba(12, 22, 36, 0.66)",
    summaryBorder: "rgba(77, 177, 255, 0.20)",
    divider: "rgba(150, 186, 242, 0.12)",
    success: "#4de2ad",
    warning: "#ff8b81",
    navBase: ["rgba(7,16,30,0.96)", "rgba(8,18,36,0.96)"],
    navBorder: "rgba(108, 169, 255, 0.18)",
    navText: "rgba(217, 230, 255, 0.66)",
    navTextActive: "#ffffff",
    bubbleBorder: "rgba(104, 195, 255, 0.44)",
    bubbleGlow: "rgba(37, 158, 255, 0.34)",
    ctaText: "#ffffff",
    ctaGradient: ["#1d9bf0", "#1366d6"],
  },
};

export function GuardHeader({ theme }: { theme: GuardHomeTheme }) {
  return (
    <View style={styles.headerRow}>
      <View>
        <Text style={[styles.brandTitle, { color: theme.text }]}>S.A.D.I.</Text>
      </View>
    </View>
  );
}

export function ThemeToggle({
  theme,
  mode,
  onToggle,
}: {
  theme: GuardHomeTheme;
  mode: GuardThemeMode;
  onToggle: () => void;
}) {
  const isDark = mode === "dark";
  const isLight = mode === "light";

  return (
    <Pressable onPress={onToggle}>
      {({ pressed }) => (
        <View
          style={[
            styles.themeToggle,
            {
              backgroundColor: theme.sectionBg,
              borderColor: theme.cardBorder,
              opacity: pressed ? 0.9 : 1,
              shadowColor: isLight ? "rgba(95, 137, 215, 0.18)" : theme.bubbleGlow,
              shadowOpacity: isLight ? 0.22 : 0.1,
              shadowRadius: isLight ? 12 : 8,
              shadowOffset: { width: 0, height: isLight ? 8 : 4 },
            },
          ]}
        >
          <View style={styles.themeTrack}>
            <View
              style={[
                styles.themeThumb,
                {
                  backgroundColor: isDark ? theme.accentStrong : "#ffffff",
                  borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(103, 132, 189, 0.12)",
                  transform: [{ translateX: isDark ? 24 : 0 }],
                  shadowColor: theme.bubbleGlow,
                },
              ]}
            >
              <Ionicons name={isDark ? "moon" : "sunny"} size={14} color={isDark ? "#ffffff" : theme.accentStrong} />
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function GuardInfoCard({
  theme,
  guardName,
  documentId,
  siteName,
  shiftName,
  shiftStatus,
}: {
  theme: GuardHomeTheme;
  guardName: string;
  documentId: string;
  siteName: string;
  shiftName: string;
  shiftStatus: string;
}) {
  const tint = theme.mode === "dark" ? "dark" : "light";
  const isOperational = /(activo|servicio)/i.test(shiftStatus);
  const isLight = theme.mode === "light";

  return (
    <View
      style={[
        styles.cardShell,
        {
          borderColor: theme.cardBorder,
          shadowColor: isLight ? "rgba(120, 158, 224, 0.22)" : theme.accentGlow,
          shadowOpacity: isLight ? 0.18 : 0.18,
          shadowRadius: isLight ? 18 : 16,
          shadowOffset: { width: 0, height: isLight ? 10 : 6 },
          backgroundColor: isLight ? "rgba(255,255,255,0.34)" : undefined,
        },
      ]}
    >
      <BlurView intensity={theme.mode === "dark" ? 34 : 48} tint={tint} style={styles.blurFill}>
        <LinearGradient
          colors={isLight ? [theme.cardBg, "rgba(241,247,255,0.72)", "rgba(255,255,255,0.52)"] : [theme.cardBg, "rgba(255,255,255,0.02)"]}
          style={styles.cardGradient}
        >
          {isLight ? <View style={styles.cardLightSheen} /> : null}
          <View style={styles.cardTopRow}>
            <View style={[styles.avatarOrb, { borderColor: theme.cardBorder, shadowColor: theme.accentGlow }]}>
              <Ionicons name="person-circle-outline" size={40} color={theme.accent} />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={[styles.greetingText, { color: theme.text }]}>Hola {guardName}</Text>
              <Text style={[styles.documentText, { color: theme.textMuted }]}>Identificacion: {documentId}</Text>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <InfoChip icon="business-outline" label="Sede" value={siteName} theme={theme} />
            <InfoChip icon="time-outline" label="Turno" value={shiftName} theme={theme} />
          </View>

          <View style={[styles.statusRow, { borderTopColor: theme.divider }]}>
            <Ionicons name="shield-checkmark-outline" size={16} color={theme.accent} />
            <Text style={[styles.statusLabel, { color: theme.textSoft }]}>Servicio</Text>
            <Text style={[styles.statusValue, { color: isOperational ? theme.success : theme.textMuted }]}>{shiftStatus}</Text>
          </View>
        </LinearGradient>
      </BlurView>
    </View>
  );
}

function InfoChip({
  icon,
  label,
  value,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  theme: GuardHomeTheme;
}) {
  const isLight = theme.mode === "light";

  return (
    <View
      style={[
        styles.infoChip,
        {
          backgroundColor: isLight ? "rgba(255,255,255,0.54)" : theme.sectionBg,
          borderColor: theme.summaryBorder,
          shadowColor: isLight ? "rgba(168, 198, 240, 0.16)" : "transparent",
          shadowOpacity: isLight ? 0.14 : 0,
          shadowRadius: isLight ? 8 : 0,
          shadowOffset: { width: 0, height: isLight ? 4 : 0 },
        },
      ]}
    >
      <Ionicons name={icon} size={15} color={theme.accent} />
      <Text style={[styles.infoChipLabel, { color: theme.textSoft }]}>{label}</Text>
      <Text style={[styles.infoChipValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

export function DailySummarySection({
  theme,
  ingresos,
  salidas,
  total,
}: {
  theme: GuardHomeTheme;
  ingresos: number | null;
  salidas: number | null;
  total: number | null;
}) {
  const isLight = theme.mode === "light";

  return (
    <View
      style={[
        styles.summaryCard,
        {
          backgroundColor: isLight ? "rgba(255,255,255,0.76)" : theme.sectionBg,
          borderColor: theme.summaryBorder,
          shadowColor: isLight ? "rgba(132, 167, 231, 0.16)" : "transparent",
          shadowOpacity: isLight ? 0.16 : 0,
          shadowRadius: isLight ? 14 : 0,
          shadowOffset: { width: 0, height: isLight ? 10 : 0 },
        },
      ]}
    >
      {isLight ? <View style={styles.summaryLightSheen} /> : null}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Resumen de Hoy</Text>
        <Text style={[styles.sectionCaption, { color: theme.textSoft }]}>Actividad del turno actual</Text>
      </View>

      <View style={styles.summaryList}>
        <SummaryItem icon="log-in-outline" label="INGRESOS" value={ingresos} theme={theme} />
        <SummaryItem icon="log-out-outline" label="SALIDAS" value={salidas} theme={theme} />
        <SummaryItem icon="layers-outline" label="TOTAL" value={total} highlight theme={theme} />
      </View>
    </View>
  );
}

function SummaryItem({
  icon,
  label,
  value,
  theme,
  highlight = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number | null;
  theme: GuardHomeTheme;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.summaryItem, { borderBottomColor: theme.divider }]}>
      <View style={[styles.summaryIconShell, { backgroundColor: theme.mode === "dark" ? "rgba(89,185,255,0.08)" : "rgba(59,130,246,0.08)" }]}>
        <Ionicons name={icon} size={18} color={highlight ? theme.accentStrong : theme.textMuted} />
      </View>
      <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: highlight ? theme.text : theme.textMuted }]}>{value == null ? "--" : value}</Text>
    </View>
  );
}

export function EndShiftButton({
  theme,
  disabled,
  loading,
  onPress,
}: {
  theme: GuardHomeTheme;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={disabled || loading} onPress={onPress}>
      {({ pressed }) => (
        <LinearGradient
          colors={disabled ? ["#94a3b8", "#94a3b8"] : theme.ctaGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.ctaButton,
            {
              opacity: pressed && !(disabled || loading) ? 0.88 : 1,
              transform: [{ scale: pressed && !(disabled || loading) ? 0.985 : 1 }],
              shadowColor: theme.bubbleGlow,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={theme.ctaText} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color={theme.ctaText} />
              <Text style={[styles.ctaText, { color: theme.ctaText }]}>{disabled ? "Turno no disponible" : "Terminar turno"}</Text>
            </>
          )}
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexShrink: 1,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  themeToggle: {
    minWidth: 72,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.1,
  },
  themeTrack: {
    width: 48,
    height: 24,
    justifyContent: "center",
  },
  themeThumb: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  cardShell: {
    borderWidth: 1,
    borderRadius: 28,
    overflow: "hidden",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  blurFill: {
    overflow: "hidden",
  },
  cardGradient: {
    padding: 22,
    gap: 18,
  },
  cardLightSheen: {
    position: "absolute",
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarOrb: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  cardTextWrap: {
    flex: 1,
  },
  greetingText: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  documentText: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
  metaGrid: {
    flexDirection: "row",
    gap: 12,
  },
  infoChip: {
    flex: 1,
    minHeight: 66,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "space-between",
  },
  infoChipLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  infoChipValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  statusValue: {
    marginLeft: "auto",
    fontSize: 14,
    fontWeight: "800",
  },
  summaryCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    gap: 16,
    overflow: "hidden",
  },
  summaryLightSheen: {
    position: "absolute",
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  sectionCaption: {
    fontSize: 13,
    fontWeight: "600",
  },
  summaryList: {
    gap: 4,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 58,
    borderBottomWidth: 1,
  },
  summaryIconShell: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "900",
  },
  ctaButton: {
    minHeight: 62,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
