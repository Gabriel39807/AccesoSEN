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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type ThemeName = "default" | "aprendiz" | "guard";
type ButtonTone = "primary" | "dark" | "danger" | "light" | "aprendiz" | "guard";
type NoticeTone = "info" | "success" | "danger";

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  theme?: ThemeName;
};

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
  bg0: "#070B11",
  bg1: "#0B1118",
  bg2: "#101722",
  surface1: "rgba(18,27,38,0.92)",
  surface2: "rgba(24,34,49,0.96)",
  surface3: "rgba(29,42,58,0.98)",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  text: "#F3F7FB",
  textSoft: "#B8C3D1",
  textMuted: "#7F90A3",
  accent: "#6FD3FF",
  accentDeep: "#4FA3FF",
  guard: "#4FA3FF",
  aprendiz: "#5FD1C4",
  success: "#42C79A",
  warning: "#F0B24D",
  warn: "#F0B24D",
  danger: "#FF6B7A",
  navy: "#132133",
  ink: "#F3F7FB",
  inkSoft: "#B8C3D1",
  muted: "#7F90A3",
  page: "#070B11",
  shadow: "#000000",
};

const themePalette: Record<
  ThemeName,
  {
    gradient: [string, string, string];
    meshPrimary: string;
    meshSecondary: string;
    accent: string;
    accentDeep: string;
    pillBg: string;
    pillBorder: string;
  }
> = {
  default: {
    gradient: ["#070B11", "#0B1118", "#101722"],
    meshPrimary: "rgba(111,211,255,0.12)",
    meshSecondary: "rgba(79,163,255,0.08)",
    accent: uiTheme.accent,
    accentDeep: uiTheme.accentDeep,
    pillBg: "rgba(111,211,255,0.12)",
    pillBorder: "rgba(111,211,255,0.22)",
  },
  aprendiz: {
    gradient: ["#070B11", "#0C141C", "#0E1820"],
    meshPrimary: "rgba(95,209,196,0.12)",
    meshSecondary: "rgba(79,163,255,0.06)",
    accent: uiTheme.aprendiz,
    accentDeep: "#36B7A8",
    pillBg: "rgba(95,209,196,0.12)",
    pillBorder: "rgba(95,209,196,0.24)",
  },
  guard: {
    gradient: ["#050A11", "#09111B", "#0C1520"],
    meshPrimary: "rgba(79,163,255,0.16)",
    meshSecondary: "rgba(111,211,255,0.08)",
    accent: uiTheme.guard,
    accentDeep: "#2E7FE8",
    pillBg: "rgba(79,163,255,0.12)",
    pillBorder: "rgba(79,163,255,0.24)",
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
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.72, duration: 4200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 4200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}> 
      <View style={styles.gridOverlay} />
      <View style={[styles.signalLine, { top: "18%", left: "8%", width: "36%" }]} />
      <View style={[styles.signalLine, { top: "28%", right: "10%", width: "24%" }]} />
      <View style={[styles.signalLine, { bottom: "22%", left: "14%", width: "42%" }]} />
      {[
        { top: "12%", left: "18%" },
        { top: "20%", left: "66%" },
        { top: "34%", left: "12%" },
        { top: "42%", left: "78%" },
        { top: "58%", left: "25%" },
        { top: "70%", left: "62%" },
        { top: "82%", left: "16%" },
      ].map((dot, index) => (
        <View key={index} style={[styles.signalDot, dot as never]} />
      ))}
    </Animated.View>
  );
}

export function ModernScreen({ children, scroll = false, contentStyle, theme = "default" }: ScreenProps) {
  const palette = themePalette[theme];
  const content = (
    <>
      <LinearGradient colors={palette.gradient} style={StyleSheet.absoluteFill} />
      <View style={[styles.meshOrb, styles.meshOrbPrimary, { backgroundColor: palette.meshPrimary }]} />
      <View style={[styles.meshOrb, styles.meshOrbSecondary, { backgroundColor: palette.meshSecondary }]} />
      <SwirlingConstellations />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, contentStyle]}>{children}</View>
      )}
    </>
  );

  return <View style={styles.root}>{content}</View>;
}

export function FadeInCard({
  children,
  delay = 0,
  style,
  intensity = 0,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
  intensity?: number;
}) {
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
        duration: 420,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        intensity > 70 ? styles.cardContainerStrong : null,
        style,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function SkeletonLine({ width = "100%", height = 14 }: { width?: ViewStyle["width"]; height?: number }) {
  return <View style={[styles.skeletonLine, { width, height }]} />;
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.skeletonCard}>
      <SkeletonLine width="42%" height={12} />
      <SkeletonLine width="68%" height={28} />
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonLine key={index} width={`${88 - index * 8}%`} height={12} />
      ))}
    </View>
  );
}

export function SkeletonList({ items = 3 }: { items?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: items }).map((_, index) => (
        <View key={index} style={styles.skeletonListItem}>
          <View style={styles.skeletonDot} />
          <View style={{ flex: 1, gap: 10 }}>
            <SkeletonLine width="56%" height={12} />
            <SkeletonLine width="82%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function TitleBlock({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function ModernButton({ label, onPress, disabled, tone = "primary", icon, imageIcon, glow = false }: ButtonProps) {
  const map: Record<ButtonTone, { bg: string; fg: string; border: string; overlay: string }> = {
    primary: { bg: uiTheme.accentDeep, fg: uiTheme.text, border: alpha(uiTheme.accent, 0.36), overlay: alpha(uiTheme.accent, 0.12) },
    dark: { bg: uiTheme.surface2, fg: uiTheme.text, border: uiTheme.borderStrong, overlay: "rgba(255,255,255,0.03)" },
    danger: { bg: alpha(uiTheme.danger, 0.16), fg: "#FFD6DC", border: alpha(uiTheme.danger, 0.34), overlay: alpha(uiTheme.danger, 0.08) },
    light: { bg: alpha("#FFFFFF", 0.02), fg: uiTheme.text, border: uiTheme.border, overlay: alpha("#FFFFFF", 0.03) },
    aprendiz: { bg: alpha(uiTheme.aprendiz, 0.16), fg: "#D9FFFA", border: alpha(uiTheme.aprendiz, 0.3), overlay: alpha(uiTheme.aprendiz, 0.1) },
    guard: { bg: alpha(uiTheme.guard, 0.16), fg: "#E9F3FF", border: alpha(uiTheme.guard, 0.3), overlay: alpha(uiTheme.guard, 0.1) },
  };

  const palette = map[tone];
  const scale = useRef(new Animated.Value(1)).current;

  const pressTo = (value: number) => {
    Animated.timing(scale, { toValue: value, duration: 120, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable disabled={disabled} onPress={onPress} onPressIn={() => pressTo(0.985)} onPressOut={() => pressTo(1)}>
        {({ pressed }) => (
          <View
            style={[
              styles.button,
              {
                backgroundColor: palette.bg,
                borderColor: palette.border,
                opacity: disabled ? 0.45 : 1,
                shadowColor: glow ? palette.border : uiTheme.shadow,
                shadowOpacity: glow ? 0.24 : 0.2,
              },
            ]}
          >
            <View style={[styles.buttonOverlay, { backgroundColor: pressed ? alpha("#FFFFFF", 0.04) : palette.overlay }]} />
            {imageIcon ? <Image source={imageIcon} style={styles.leadingImageIcon} /> : null}
            {icon ? <Ionicons name={icon} size={18} color={palette.fg} style={styles.leadingIcon} /> : null}
            {!!label && <Text style={[styles.buttonText, { color: palette.fg }]}>{label}</Text>}
          </View>
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
        {imageIcon ? <Image source={imageIcon} style={styles.inputImageIcon} /> : null}
        {icon ? <Ionicons name={icon} size={18} color={iconColor ?? uiTheme.textMuted} style={styles.inputIcon} /> : null}
        <TextInput
          {...props}
          placeholderTextColor={uiTheme.textMuted}
          style={[styles.input, props.style as any]}
          selectionColor={uiTheme.accent}
        />
        {(rightIcon || rightImageIcon) && (
          <Pressable onPress={onRightIconPress} style={styles.trailingPressable}>
            {rightImageIcon ? <Image source={rightImageIcon} style={styles.trailingImageIcon} /> : null}
            {rightIcon ? <Ionicons name={rightIcon} size={20} color={rightIconColor ?? uiTheme.textMuted} /> : null}
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
    primary: { bg: alpha(uiTheme.accent, 0.12), text: uiTheme.text, border: alpha(uiTheme.accent, 0.22) },
    warning: { bg: alpha(uiTheme.warning, 0.14), text: "#FFE8BF", border: alpha(uiTheme.warning, 0.24) },
    success: { bg: alpha(uiTheme.success, 0.14), text: "#D8FFF1", border: alpha(uiTheme.success, 0.24) },
    danger: { bg: alpha(uiTheme.danger, 0.14), text: "#FFD6DC", border: alpha(uiTheme.danger, 0.24) },
    aprendiz: { bg: themePalette.aprendiz.pillBg, text: "#D9FFFA", border: themePalette.aprendiz.pillBorder },
    guard: { bg: themePalette.guard.pillBg, text: "#E9F3FF", border: themePalette.guard.pillBorder },
  };

  const palette = map[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      {imageIcon ? <Image source={imageIcon} style={styles.pillImageIcon} /> : null}
      {icon ? <Ionicons name={icon} size={13} color={palette.text} style={{ marginRight: 6 }} /> : null}
      <Text style={[styles.pillText, { color: palette.text }]}>{text}</Text>
    </View>
  );
}

export function LoadingBlock({ label = "Cargando..." }: { label?: string }) {
  return (
    <View style={styles.statusBlock}>
      <ActivityIndicator color={uiTheme.accent} />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={22} color={uiTheme.accent} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

export function NoticeBanner({ tone = "info", text }: { tone?: NoticeTone; text: string }) {
  const palette = {
    info: { bg: alpha(uiTheme.accent, 0.12), border: alpha(uiTheme.accent, 0.22), fg: uiTheme.text, icon: "information-circle-outline" as const },
    success: { bg: alpha(uiTheme.success, 0.14), border: alpha(uiTheme.success, 0.22), fg: "#D8FFF1", icon: "checkmark-circle-outline" as const },
    danger: { bg: alpha(uiTheme.danger, 0.14), border: alpha(uiTheme.danger, 0.22), fg: "#FFD6DC", icon: "alert-circle-outline" as const },
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
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 28 : 24,
    paddingBottom: 20,
    gap: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 28 : 24,
    paddingBottom: 40,
    gap: 16,
  },
  meshOrb: {
    position: "absolute",
    borderRadius: 999,
  },
  meshOrbPrimary: {
    width: 280,
    height: 280,
    top: -90,
    right: -90,
  },
  meshOrbSecondary: {
    width: 300,
    height: 300,
    bottom: -120,
    left: -120,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderColor: "rgba(255,255,255,0.03)",
    borderWidth: 0,
  },
  signalLine: {
    position: "absolute",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  signalDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  cardContainer: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: uiTheme.surface1,
    borderWidth: 1,
    borderColor: uiTheme.border,
    shadowColor: uiTheme.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    overflow: "hidden",
    gap: 12,
  },
  cardContainerStrong: {
    backgroundColor: uiTheme.surface2,
    borderColor: uiTheme.borderStrong,
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "800",
    color: uiTheme.text,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: uiTheme.textSoft,
  },
  button: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    overflow: "hidden",
  },
  buttonOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  leadingIcon: {
    zIndex: 1,
  },
  leadingImageIcon: {
    width: 18,
    height: 18,
    resizeMode: "contain",
    zIndex: 1,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.1,
    zIndex: 1,
  },
  inputLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: uiTheme.textMuted,
    fontWeight: "700",
  },
  inputWrapper: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: uiTheme.border,
    backgroundColor: uiTheme.surface2,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  inputIcon: {
    opacity: 0.9,
  },
  input: {
    flex: 1,
    color: uiTheme.text,
    fontSize: 15,
    paddingVertical: 14,
  },
  inputImageIcon: {
    width: 18,
    height: 18,
    resizeMode: "contain",
  },
  trailingPressable: {
    paddingLeft: 8,
    paddingVertical: 4,
  },
  trailingImageIcon: {
    width: 18,
    height: 18,
    resizeMode: "contain",
  },
  pill: {
    alignSelf: "flex-start",
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  pillImageIcon: {
    width: 14,
    height: 14,
    resizeMode: "contain",
    marginRight: 6,
  },
  statusBlock: {
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: uiTheme.border,
    backgroundColor: alpha(uiTheme.surface3, 0.9),
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  statusText: {
    color: uiTheme.textSoft,
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 10,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: alpha(uiTheme.accent, 0.1),
    borderWidth: 1,
    borderColor: alpha(uiTheme.accent, 0.18),
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: uiTheme.text,
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtitle: {
    color: uiTheme.textSoft,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  noticeBanner: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  skeletonCard: {
    borderRadius: 18,
    backgroundColor: alpha("#FFFFFF", 0.03),
    borderWidth: 1,
    borderColor: uiTheme.border,
    padding: 16,
    gap: 10,
  },
  skeletonLine: {
    borderRadius: 999,
    backgroundColor: alpha("#FFFFFF", 0.08),
  },
  skeletonListItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    backgroundColor: alpha("#FFFFFF", 0.03),
    borderWidth: 1,
    borderColor: uiTheme.border,
    padding: 14,
  },
  skeletonDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: alpha("#FFFFFF", 0.08),
  },
});

