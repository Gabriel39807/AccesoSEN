import React, { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSegments } from "expo-router";

import { useSessionStore } from "../store/session";
import { useSystemBranding } from "../theme/system-branding";

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  bottomAccessory?: React.ReactNode;
};

type ButtonTone = "primary" | "dark" | "danger" | "light";

type NoticeTone = "info" | "success" | "danger";

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: ButtonTone;
  icon?: keyof typeof Ionicons.glyphMap;
};

export const uiTheme = {
  ink: "#0b1220",
  inkSoft: "#334155",
  muted: "#64748b",
  border: "rgba(148, 163, 184, 0.22)",
  surface: "rgba(255,255,255,0.78)",
  surfaceStrong: "#ffffff",
  panel: "#e2e8f0",
  accent: "#0f766e",
  accentSoft: "#d7f5ef",
  accentDeep: "#134e4a",
  warn: "#a16207",
  danger: "#b91c1c",
  success: "#15803d",
  navy: "#0f172a",
  shadow: "#0f172a",
  page: "#edf4f5",
};

type DynamicUiTheme = typeof uiTheme;

function resolveRoleScope(segments: string[], userRole?: string | null): "aprendiz" | "guarda" | "admin" {
  if (segments.includes("guard")) return "guarda";
  if (segments.includes("aprendiz")) return "aprendiz";
  if (userRole === "guarda") return "guarda";
  if (userRole === "aprendiz") return "aprendiz";
  return "admin";
}

function alpha(hex: string, opacity: number) {
  const value = String(hex || "").replace("#", "").trim();
  if (value.length !== 6) return `rgba(15,118,110,${opacity})`;
  const bigint = Number.parseInt(value, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${opacity})`;
}

function useDynamicUiTheme(): DynamicUiTheme {
  const segments = useSegments();
  const userRole = useSessionStore((state) => state.user?.rol ?? null);
  const { config } = useSystemBranding();

  return useMemo(() => {
    const scope = resolveRoleScope(segments, userRole);
    const accent =
      scope === "aprendiz"
        ? config.color_aprendiz_light
        : scope === "guarda"
          ? config.color_guarda_light
          : config.color_admin_light;

    return {
      ...uiTheme,
      accent,
      accentSoft: alpha(accent, 0.12),
      accentDeep: accent,
    };
  }, [config, segments, userRole]);
}

async function triggerHaptic(tone: ButtonTone) {
  try {
    if (tone === "danger") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (tone === "primary") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    await Haptics.selectionAsync();
  } catch {
    // Ignore haptic failures on unsupported platforms.
  }
}

export function ModernScreen({ children, scroll = false, contentStyle, bottomAccessory }: ScreenProps) {
  const theme = useDynamicUiTheme();
  const Container: any = scroll ? ScrollView : View;
  const inner = <View style={[styles.inner, contentStyle]}>{children}</View>;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style="dark" />
      <View style={[styles.root, { backgroundColor: theme.page }]}>
        <View style={[styles.bgBase, { backgroundColor: theme.page }]} />
        <View style={[styles.bgGlowTop, { backgroundColor: alpha(theme.accent, 0.17) }]} />
        <View style={styles.bgGlowMid} />
        <View style={styles.bgGlowBottom} />
        <View style={styles.bgGlassBand} />
        <View style={styles.bgLineLeft} />
        <View style={styles.bgLineRight} />
        <Container
          contentContainerStyle={scroll ? [styles.scrollContent, bottomAccessory ? styles.scrollContentWithAccessory : null] : undefined}
          style={!scroll ? styles.content : undefined}
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </Container>
        {bottomAccessory ? <View style={styles.bottomAccessory}>{bottomAccessory}</View> : null}
      </View>
    </SafeAreaView>
  );
}

export function FadeInCard({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: ViewStyle }) {
  const theme = useDynamicUiTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 360,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 360,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.card,
        { shadowColor: theme.shadow, borderColor: theme.border, backgroundColor: theme.surface },
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={[styles.cardInnerGlow, { backgroundColor: alpha(theme.accent, 0.08) }]} />
      <View style={styles.cardContent}>{children}</View>
    </Animated.View>
  );
}

function usePulse(min = 0.45, max = 0.9) {
  const opacity = useRef(new Animated.Value(min)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: max, duration: 820, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: min, duration: 820, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [max, min, opacity]);

  return opacity;
}

export function SkeletonLine({ width = "100%", height = 14 }: { width?: ViewStyle["width"]; height?: number }) {
  const opacity = usePulse();
  return <Animated.View style={[styles.skeletonLine, { width, height, opacity }]} />;
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.skeletonCard}>
      <SkeletonLine width="36%" height={12} />
      <SkeletonLine width="72%" height={24} />
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonLine key={index} width={index === rows - 1 ? "58%" : "100%"} height={14} />
      ))}
    </View>
  );
}

export function SkeletonList({ items = 3 }: { items?: number }) {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: items }).map((_, index) => (
        <View key={index} style={styles.listSkeletonItem}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <SkeletonLine width="24%" height={14} />
            <SkeletonLine width={70} height={22} />
          </View>
          <SkeletonLine width="78%" height={14} />
          <SkeletonLine width="46%" height={12} />
        </View>
      ))}
    </View>
  );
}

export function TitleBlock({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useDynamicUiTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: theme.inkSoft }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function ModernButton({ label, onPress, disabled, tone = "primary", icon }: ButtonProps) {
  const theme = useDynamicUiTheme();
  const buttonToneMap: Record<ButtonTone, { bg: string; fg: string; border: string; shadow: string }> = {
    primary: { bg: theme.accent, fg: "#ffffff", border: alpha(theme.accent, 0.42), shadow: alpha(theme.accent, 0.28) },
    dark: { bg: theme.navy, fg: "#ffffff", border: "rgba(15,23,42,0.34)", shadow: "rgba(15,23,42,0.22)" },
    danger: { bg: theme.danger, fg: "#ffffff", border: "rgba(185,28,28,0.34)", shadow: "rgba(185,28,28,0.2)" },
    light: { bg: "rgba(255,255,255,0.72)", fg: theme.ink, border: "rgba(148,163,184,0.22)", shadow: "rgba(15,23,42,0.08)" },
  };
  const toneStyles = buttonToneMap[tone];

  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        void triggerHaptic(tone);
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: disabled ? "rgba(148,163,184,0.5)" : toneStyles.bg,
          borderColor: disabled ? "rgba(148,163,184,0.3)" : toneStyles.border,
          opacity: pressed ? 0.97 : 1,
          transform: [{ scale: pressed ? 0.988 : 1 }],
          shadowColor: disabled ? "rgba(15,23,42,0.08)" : toneStyles.shadow,
        },
      ]}
    >
      <View style={styles.buttonInner}>
        {icon ? <Ionicons name={icon} size={18} color={toneStyles.fg} /> : null}
        <Text style={[styles.buttonText, { color: toneStyles.fg }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function InputField({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useDynamicUiTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.inputLabel, { color: theme.muted }]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={theme.muted}
        selectionColor={theme.accent}
        style={[styles.input, { color: theme.ink }, props.style as any]}
      />
    </View>
  );
}

export function Pill({ text }: { text: string }) {
  const theme = useDynamicUiTheme();
  return (
    <View style={[styles.pill, { borderColor: alpha(theme.accent, 0.22) }]}>
      <Text style={[styles.pillText, { color: theme.accentDeep }]}>{text}</Text>
    </View>
  );
}

export function LoadingBlock({ label = "Cargando..." }: { label?: string }) {
  const theme = useDynamicUiTheme();
  return (
    <View style={styles.statusBlock}>
      <ActivityIndicator color={theme.accent} />
      <Text style={[styles.statusText, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  const theme = useDynamicUiTheme();
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconWrap, { backgroundColor: alpha(theme.accent, 0.1), borderColor: alpha(theme.accent, 0.14) }]}>
        <Ionicons name={icon} size={24} color={theme.accentDeep} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.ink }]}>{title}</Text>
      <Text style={[styles.emptySubtitle, { color: theme.inkSoft }]}>{subtitle}</Text>
    </View>
  );
}

export function NoticeBanner({ tone = "info", text }: { tone?: NoticeTone; text: string }) {
  const theme = useDynamicUiTheme();
  const palette = {
    info: { bg: alpha(theme.accent, 0.08), border: alpha(theme.accent, 0.16), fg: theme.accentDeep, icon: "information-circle-outline" as const },
    success: { bg: "rgba(21,128,61,0.08)", border: "rgba(21,128,61,0.16)", fg: theme.success, icon: "checkmark-circle-outline" as const },
    danger: { bg: "rgba(185,28,28,0.08)", border: "rgba(185,28,28,0.16)", fg: theme.danger, icon: "alert-circle-outline" as const },
  }[tone];

  return (
    <View style={[styles.noticeBanner, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Ionicons name={palette.icon} size={18} color={palette.fg} />
      <Text style={[styles.noticeText, { color: palette.fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: uiTheme.page,
  },
  root: {
    flex: 1,
    backgroundColor: uiTheme.page,
  },
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: uiTheme.page,
  },
  bgGlowTop: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "rgba(15,118,110,0.17)",
    top: -122,
    right: -96,
  },
  bgGlowMid: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(255,255,255,0.58)",
    top: 156,
    left: -128,
  },
  bgGlowBottom: {
    position: "absolute",
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: "rgba(15,23,42,0.07)",
    bottom: -182,
    right: -138,
  },
  bgGlassBand: {
    position: "absolute",
    top: 98,
    left: 18,
    right: 18,
    height: 112,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  bgLineLeft: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 18,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.34)",
  },
  bgLineRight: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 18,
    width: 1,
    backgroundColor: "rgba(148,163,184,0.16)",
  },
  content: {
    flex: 1,
    paddingBottom: 20,
  },
  inner: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 14,
  },
  scrollContent: {
    paddingBottom: 42,
  },
  scrollContentWithAccessory: {
    paddingBottom: 148,
  },
  bottomAccessory: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingBottom: 18,
    alignItems: "center",
  },
  card: {
    backgroundColor: uiTheme.surface,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: uiTheme.border,
    overflow: "hidden",
    shadowColor: uiTheme.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  cardInnerGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 68,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  cardContent: {
    padding: 18,
    gap: 0,
  },
  skeletonCard: {
    gap: 12,
    paddingVertical: 4,
  },
  skeletonLine: {
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.26)",
  },
  listSkeletonItem: {
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    color: uiTheme.ink,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: uiTheme.inkSoft,
  },
  inputLabel: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: uiTheme.muted,
    fontWeight: "800",
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: "rgba(255,255,255,0.9)",
    color: uiTheme.ink,
    fontSize: 15,
    shadowColor: "rgba(255,255,255,0.8)",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 1 },
  },
  button: {
    minHeight: 58,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: {
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 0.3,
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.74)",
    borderColor: "rgba(15,118,110,0.22)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillText: {
    color: uiTheme.accentDeep,
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1,
  },
  statusBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 10,
  },
  statusText: {
    color: uiTheme.muted,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 12,
    gap: 10,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,118,110,0.1)",
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.14)",
  },
  emptyTitle: {
    color: uiTheme.ink,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  emptySubtitle: {
    color: uiTheme.inkSoft,
    lineHeight: 20,
    textAlign: "center",
  },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeText: {
    flex: 1,
    lineHeight: 20,
    fontWeight: "700",
  },
});
