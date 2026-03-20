import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type ThemeName = "default" | "aprendiz" | "guard";

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  theme?: ThemeName;
};

type ButtonTone = "primary" | "dark" | "danger" | "light" | "aprendiz" | "guard";
type NoticeTone = "info" | "success" | "danger";

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: ButtonTone;
  icon?: keyof typeof Ionicons.glyphMap;
  imageIcon?: ImageSourcePropType;
  glow?: boolean;
};

export const uiTheme = {
  ink: "#0f172a",
  inkSoft: "#334155",
  muted: "#64748b",
  border: "rgba(148, 163, 184, 0.22)",
  surface: "rgba(255,255,255,0.78)",
  surfaceStrong: "#ffffff",
  panel: "#e2e8f0",
  accent: "#4f46e5",
  accentSoft: "rgba(79, 70, 229, 0.12)",
  accentDeep: "#4338ca",
  warn: "#a16207",
  danger: "#b91c1c",
  success: "#15803d",
  navy: "#0f172a",
  shadow: "#0f172a",
  page: "#f8fafc",
};

const PATTERN_ICONS: (keyof typeof Ionicons.glyphMap)[] = [
  "shield-outline",
  "shield-checkmark-outline",
  "key-outline",
  "lock-closed-outline",
  "finger-print-outline",
  "id-card-outline",
  "school-outline",
  "book-outline",
  "library-outline",
  "person-outline",
  "people-outline",
  "scan-outline",
  "barcode-outline",
  "time-outline",
  "location-outline",
  "checkmark-circle-outline",
  "eye-outline",
  "document-text-outline",
  "desktop-outline",
  "briefcase-outline",
];

const themePalette: Record<
  ThemeName,
  {
    gradient: string[];
    orbPrimary: string;
    orbSecondary: string;
    accent: string;
    accentDeep: string;
    pillBg: string;
    pillBorder: string;
  }
> = {
  default: {
    gradient: ["#f8fafc", "#eef2ff", "#ffffff"],
    orbPrimary: "rgba(99, 102, 241, 0.22)",
    orbSecondary: "rgba(236, 72, 153, 0.14)",
    accent: "#4f46e5",
    accentDeep: "#4338ca",
    pillBg: "rgba(99, 102, 241, 0.14)",
    pillBorder: "rgba(99, 102, 241, 0.26)",
  },
  aprendiz: {
    gradient: ["#f0f9ff", "#e0f2fe", "#ffffff"],
    orbPrimary: "rgba(14, 165, 233, 0.22)",
    orbSecondary: "rgba(56, 189, 248, 0.14)",
    accent: "#0ea5e9",
    accentDeep: "#0369a1",
    pillBg: "rgba(14, 165, 233, 0.14)",
    pillBorder: "rgba(14, 165, 233, 0.26)",
  },
  guard: {
    gradient: ["#eff6ff", "#dbeafe", "#ffffff"],
    orbPrimary: "rgba(30, 58, 138, 0.2)",
    orbSecondary: "rgba(59, 130, 246, 0.14)",
    accent: "#1e40af",
    accentDeep: "#1e3a8a",
    pillBg: "rgba(30, 58, 138, 0.14)",
    pillBorder: "rgba(30, 58, 138, 0.28)",
  },
};

function alpha(hex: string, opacity: number) {
  const value = String(hex || "").replace("#", "").trim();
  if (value.length !== 6) return `rgba(15,23,42,${opacity})`;
  const bigint = Number.parseInt(value, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function SwirlingConstellations() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 8000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 8000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -15] });
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "4deg"] });

  const positions = [
    { top: "8%", left: "12%", icon: PATTERN_ICONS[0], size: 36, o: 0.12 },
    { top: "15%", left: "5%", icon: PATTERN_ICONS[1], size: 22, o: 0.08 },
    { top: "22%", left: "18%", icon: PATTERN_ICONS[2], size: 28, o: 0.15 },
    { top: "12%", left: "26%", icon: PATTERN_ICONS[3], size: 20, o: 0.06 },
    { top: "5%", left: "45%", icon: PATTERN_ICONS[4], size: 40, o: 0.09 },
    { top: "10%", left: "65%", icon: PATTERN_ICONS[5], size: 26, o: 0.11 },
    { top: "18%", left: "80%", icon: PATTERN_ICONS[6], size: 32, o: 0.14 },
    { top: "8%", left: "88%", icon: PATTERN_ICONS[7], size: 24, o: 0.07 },
    { top: "35%", left: "8%", icon: PATTERN_ICONS[8], size: 30, o: 0.1 },
    { top: "45%", left: "16%", icon: PATTERN_ICONS[9], size: 45, o: 0.05 },
    { top: "55%", left: "5%", icon: PATTERN_ICONS[10], size: 22, o: 0.12 },
    { top: "32%", left: "35%", icon: PATTERN_ICONS[11], size: 25, o: 0.08 },
    { top: "40%", left: "60%", icon: PATTERN_ICONS[12], size: 38, o: 0.11 },
    { top: "50%", left: "45%", icon: PATTERN_ICONS[13], size: 28, o: 0.14 },
    { top: "65%", left: "35%", icon: PATTERN_ICONS[14], size: 34, o: 0.09 },
    { top: "32%", left: "85%", icon: PATTERN_ICONS[15], size: 26, o: 0.13 },
    { top: "45%", left: "92%", icon: PATTERN_ICONS[16], size: 32, o: 0.07 },
    { top: "55%", left: "78%", icon: PATTERN_ICONS[17], size: 24, o: 0.1 },
    { top: "75%", left: "15%", icon: PATTERN_ICONS[18], size: 30, o: 0.08 },
    { top: "85%", left: "25%", icon: PATTERN_ICONS[19], size: 20, o: 0.11 },
    { top: "70%", left: "55%", icon: PATTERN_ICONS[0], size: 36, o: 0.06 },
    { top: "80%", left: "70%", icon: PATTERN_ICONS[1], size: 26, o: 0.12 },
    { top: "88%", left: "85%", icon: PATTERN_ICONS[2], size: 28, o: 0.09 },
    { top: "92%", left: "45%", icon: PATTERN_ICONS[3], size: 22, o: 0.07 },
  ];

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateY }, { rotate }] }]}>
      {positions.map((item, idx) => (
        <Ionicons
          key={idx}
          name={item.icon}
          size={item.size}
          color="#94a3b8"
          style={{
            position: "absolute",
            top: item.top as never,
            left: item.left as never,
            opacity: item.o,
          }}
        />
      ))}
    </Animated.View>
  );
}

export function ModernScreen({ children, scroll = false, contentStyle, theme = "default" }: ScreenProps) {
  const Container: React.ComponentType<any> = scroll ? ScrollView : View;
  const palette = themePalette[theme];

  return (
    <View style={styles.root}>
      <LinearGradient colors={palette.gradient as [string, string, ...string[]]} style={StyleSheet.absoluteFill} />
      <View style={[styles.bgOrb, styles.bgOrbPrimary, { backgroundColor: palette.orbPrimary }]} />
      <View style={[styles.bgOrb, styles.bgOrbSecondary, { backgroundColor: palette.orbSecondary }]} />
      {theme === "guard" ? <SwirlingConstellations /> : null}
      <Container
        contentContainerStyle={scroll ? [styles.scrollContent, contentStyle] : undefined}
        style={!scroll ? [styles.content, contentStyle] : undefined}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Container>
    </View>
  );
}

export function FadeInCard({
  children,
  delay = 0,
  style,
  intensity = 60,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
  intensity?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        delay,
        easing: Easing.out(Easing.bezier(0.25, 1, 0.5, 1)),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        delay,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <BlurView intensity={intensity} tint="light" style={styles.glassCard}>
        {children}
      </BlurView>
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
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function ModernButton({ label, onPress, disabled, tone = "primary", icon, imageIcon, glow = false }: ButtonProps) {
  const map: Record<ButtonTone, { bg: string; fg: string; border: string; gradient: [string, string] }> = {
    primary: { bg: "#4f46e5", fg: "#ffffff", border: "rgba(255,255,255,0.2)", gradient: ["#6366f1", "#4f46e5"] },
    dark: { bg: "#0f172a", fg: "#f8fafc", border: "rgba(255,255,255,0.1)", gradient: ["#1e293b", "#0f172a"] },
    danger: { bg: "#e11d48", fg: "#ffffff", border: "rgba(255,255,255,0.2)", gradient: ["#f43f5e", "#e11d48"] },
    light: { bg: "rgba(255,255,255,0.8)", fg: "#0f172a", border: "#e2e8f0", gradient: ["#ffffff", "#f8fafc"] },
    aprendiz: { bg: "#0ea5e9", fg: "#ffffff", border: "rgba(255,255,255,0.2)", gradient: ["#38bdf8", "#0ea5e9"] },
    guard: { bg: "#1e3a8a", fg: "#ffffff", border: "rgba(255,255,255,0.2)", gradient: ["#1e40af", "#172554"] },
  };

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const palette = map[tone];

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 25,
      bounciness: 12,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable disabled={disabled} onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress}>
        {({ pressed }) => (
          <LinearGradient
            colors={disabled ? ["#cbd5e1", "#cbd5e1"] : palette.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.button,
              {
                borderColor: disabled ? "#94a3b8" : palette.border,
                opacity: pressed && !disabled ? 0.88 : 1,
                ...(glow && !disabled
                  ? {
                      shadowColor: "#ffffff",
                      shadowOpacity: 0.8,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 10,
                    }
                  : {}),
              },
            ]}
          >
            {imageIcon ? (
              <Image source={imageIcon} style={styles.leadingImageIcon} />
            ) : icon ? (
              <Ionicons
                name={icon}
                size={20}
                color={disabled ? "#f8fafc" : palette.fg}
                style={[
                  styles.leadingIcon,
                  glow && !disabled ? styles.glowText : undefined,
                ]}
              />
            ) : null}
            <Text
              style={[
                styles.buttonText,
                { color: disabled ? "#f8fafc" : palette.fg },
                glow && !disabled ? styles.glowText : undefined,
              ]}
            >
              {label}
            </Text>
          </LinearGradient>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function InputField({
  label,
  icon,
  rightIcon,
  onRightIconPress,
  iconColor,
  rightIconColor,
  imageIcon,
  rightImageIcon,
  wrapperStyle,
  ...props
}: TextInputProps & {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  iconColor?: string;
  rightIconColor?: string;
  imageIcon?: ImageSourcePropType;
  rightImageIcon?: ImageSourcePropType;
  wrapperStyle?: ViewStyle;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputWrapper, wrapperStyle]}>
        {imageIcon ? (
          <Image source={imageIcon} style={styles.inputImageIcon} />
        ) : icon ? (
          <Ionicons name={icon} size={20} color={iconColor ?? "#0ea5e9"} style={styles.inputIcon} />
        ) : null}
        <TextInput {...props} placeholderTextColor="#94a3b8" style={[styles.input, props.style as any]} />
        {(rightIcon || rightImageIcon) && (
          <Pressable onPress={onRightIconPress} style={{ padding: 4 }}>
            {rightImageIcon ? (
              <Image source={rightImageIcon} style={styles.trailingImageIcon} />
            ) : rightIcon ? (
              <Ionicons name={rightIcon} size={22} color={rightIconColor ?? "#94a3b8"} />
            ) : null}
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function Pill({
  text,
  icon,
  imageIcon,
  tone = "primary",
}: {
  text: string;
  icon?: keyof typeof Ionicons.glyphMap;
  imageIcon?: ImageSourcePropType;
  tone?: "primary" | "warning" | "success" | "danger" | "aprendiz" | "guard";
}) {
  const map = {
    primary: { bg: "rgba(99, 102, 241, 0.15)", text: "#4338ca", border: "rgba(99, 102, 241, 0.3)" },
    warning: { bg: "rgba(245, 158, 11, 0.15)", text: "#b45309", border: "rgba(245, 158, 11, 0.3)" },
    success: { bg: "rgba(16, 185, 129, 0.15)", text: "#047857", border: "rgba(16, 185, 129, 0.3)" },
    danger: { bg: "rgba(225, 29, 72, 0.15)", text: "#be123c", border: "rgba(225, 29, 72, 0.3)" },
    aprendiz: themePalette.aprendiz,
    guard: themePalette.guard,
  };

  const palette =
    tone === "aprendiz" || tone === "guard"
      ? { bg: map[tone].pillBg, text: map[tone].accentDeep, border: map[tone].pillBorder }
      : map[tone];

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      {imageIcon ? (
        <Image source={imageIcon} style={styles.pillImageIcon} />
      ) : icon ? (
        <Ionicons name={icon} size={14} color={palette.text} style={{ marginRight: 4 }} />
      ) : null}
      <Text style={[styles.pillText, { color: palette.text }]}>{text}</Text>
    </View>
  );
}

export function LoadingBlock({ label = "Cargando..." }: { label?: string }) {
  return (
    <View style={styles.statusBlock}>
      <ActivityIndicator color={uiTheme.accent} />
      <Text style={[styles.statusText, { color: uiTheme.muted }]}>{label}</Text>
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
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={24} color={uiTheme.accentDeep} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

export function NoticeBanner({ tone = "info", text }: { tone?: NoticeTone; text: string }) {
  const palette = {
    info: { bg: alpha(uiTheme.accent, 0.08), border: alpha(uiTheme.accent, 0.16), fg: uiTheme.accentDeep, icon: "information-circle-outline" as const },
    success: { bg: "rgba(21,128,61,0.08)", border: "rgba(21,128,61,0.16)", fg: uiTheme.success, icon: "checkmark-circle-outline" as const },
    danger: { bg: "rgba(185,28,28,0.08)", border: "rgba(185,28,28,0.16)", fg: uiTheme.danger, icon: "alert-circle-outline" as const },
  }[tone];

  return (
    <View style={[styles.noticeBanner, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Ionicons name={palette.icon} size={18} color={palette.fg} />
      <Text style={[styles.noticeText, { color: palette.fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: uiTheme.page,
  },
  bgOrb: {
    position: "absolute",
    borderRadius: 999,
  },
  bgOrbPrimary: {
    width: 350,
    height: 350,
    top: -80,
    right: -100,
  },
  bgOrbSecondary: {
    width: 400,
    height: 400,
    bottom: -150,
    left: -120,
  },
  content: {
    flex: 1,
    padding: 24,
    gap: 20,
  },
  scrollContent: {
    padding: 24,
    gap: 20,
    paddingBottom: 50,
    paddingTop: Platform.OS === "ios" ? 30 : 40,
  },
  cardContainer: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.6)",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 15 },
    elevation: Platform.OS === "android" ? 0 : 5,
    backgroundColor: Platform.OS === "android" ? "rgba(255,255,255,0.9)" : "transparent",
  },
  glassCard: {
    padding: 24,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: uiTheme.ink,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    color: "#475569",
    fontWeight: "500",
    lineHeight: 22,
  },
  inputLabel: {
    fontSize: 12,
    color: uiTheme.muted,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.4)",
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  inputImageIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
    resizeMode: "contain",
  },
  trailingImageIcon: {
    width: 22,
    height: 22,
    resizeMode: "contain",
  },
  leadingImageIcon: {
    width: 22,
    height: 22,
    marginRight: 8,
    resizeMode: "contain",
  },
  pillImageIcon: {
    width: 16,
    height: 16,
    marginRight: 4,
    resizeMode: "contain",
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    color: uiTheme.ink,
    fontSize: 16,
    fontWeight: "600",
  },
  button: {
    flexDirection: "row",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  leadingIcon: {
    marginRight: 8,
  },
  glowText: {
    textShadowColor: "rgba(255,255,255,0.7)",
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  buttonText: {
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  pillText: {
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
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
    borderColor: uiTheme.border,
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  statusBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 10,
  },
  statusText: {
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
    backgroundColor: alpha(uiTheme.accent, 0.1),
    borderWidth: 1,
    borderColor: alpha(uiTheme.accent, 0.14),
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
