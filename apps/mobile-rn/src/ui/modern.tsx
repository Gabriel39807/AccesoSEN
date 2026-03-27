import React, { useEffect, useMemo, useRef } from "react";
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
import { useResolvedThemeMode } from "../store/preferences";

type ThemeKey = "default" | "aprendiz" | "guard";

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  theme?: ThemeKey;
};

type BrandTheme = {
  mode: "light" | "dark";
  background: [string, string, string];
  ambientTop: [string, string, string];
  ambientBeam: [string, string, string];
  ambientBottom: [string, string, string];
  meshBorder: string;
  surface: string;
  surfaceStrong: string;
  surfaceBorder: string;
  text: string;
  textMuted: string;
  textSoft: string;
  accent: string;
  accentStrong: string;
  accentGlow: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
};

function resolveTheme(theme: ThemeKey, mode: "light" | "dark"): BrandTheme {
  const palettes = {
    default: {
      light: {
        background: ["#fbfdff", "#f3f7ff", "#e8efff"],
        ambientTop: ["rgba(127,156,255,0.12)", "rgba(127,156,255,0.03)", "transparent"],
        ambientBeam: ["transparent", "rgba(196,208,255,0.14)", "rgba(255,255,255,0.03)"],
        ambientBottom: ["rgba(255,255,255,0.02)", "rgba(214,226,255,0.16)", "rgba(243,247,255,0.2)"],
        meshBorder: "rgba(169, 188, 227, 0.18)",
        surface: "rgba(255,255,255,0.78)",
        surfaceStrong: "rgba(255,255,255,0.88)",
        surfaceBorder: "rgba(116, 151, 221, 0.16)",
        text: "#16213d",
        textMuted: "#455b83",
        textSoft: "#6d7d9d",
        accent: "#4967d8",
        accentStrong: "#2749b5",
        accentGlow: "rgba(95, 122, 214, 0.18)",
        inputBg: "rgba(255,255,255,0.92)",
        inputBorder: "rgba(129, 160, 227, 0.26)",
        inputText: "#16213d",
        pillBg: "rgba(73, 103, 216, 0.08)",
        pillBorder: "rgba(73, 103, 216, 0.18)",
        pillText: "#3f5fc8",
      },
      dark: {
        background: ["#091220", "#0d1a32", "#102744"],
        ambientTop: ["rgba(95,171,255,0.12)", "rgba(95,171,255,0.03)", "transparent"],
        ambientBeam: ["transparent", "rgba(52,113,215,0.10)", "transparent"],
        ambientBottom: ["transparent", "rgba(68,134,230,0.08)", "rgba(68,134,230,0.02)"],
        meshBorder: "rgba(105, 154, 233, 0.10)",
        surface: "rgba(11,20,34,0.74)",
        surfaceStrong: "rgba(15,24,40,0.88)",
        surfaceBorder: "rgba(92, 150, 235, 0.18)",
        text: "#f8fbff",
        textMuted: "#d8e2f8",
        textSoft: "#94a5c4",
        accent: "#59b9ff",
        accentStrong: "#1d97ff",
        accentGlow: "rgba(41, 147, 255, 0.28)",
        inputBg: "rgba(15,24,40,0.82)",
        inputBorder: "rgba(95, 161, 255, 0.20)",
        inputText: "#f8fbff",
        pillBg: "rgba(89,185,255,0.12)",
        pillBorder: "rgba(89,185,255,0.22)",
        pillText: "#8bd2ff",
      },
    },
    aprendiz: {
      light: {
        background: ["#fbfdff", "#f2f8ff", "#e7f1ff"],
        ambientTop: ["rgba(102,194,255,0.12)", "rgba(102,194,255,0.03)", "transparent"],
        ambientBeam: ["transparent", "rgba(190,232,255,0.16)", "rgba(255,255,255,0.03)"],
        ambientBottom: ["rgba(255,255,255,0.02)", "rgba(204,233,255,0.16)", "rgba(243,250,255,0.2)"],
        meshBorder: "rgba(168, 207, 232, 0.18)",
        surface: "rgba(255,255,255,0.8)",
        surfaceStrong: "rgba(255,255,255,0.9)",
        surfaceBorder: "rgba(88, 172, 226, 0.16)",
        text: "#14253d",
        textMuted: "#3b6287",
        textSoft: "#6b88a8",
        accent: "#0ea5e9",
        accentStrong: "#0284c7",
        accentGlow: "rgba(14, 165, 233, 0.18)",
        inputBg: "rgba(255,255,255,0.92)",
        inputBorder: "rgba(102, 194, 255, 0.24)",
        inputText: "#14253d",
        pillBg: "rgba(14,165,233,0.08)",
        pillBorder: "rgba(14,165,233,0.18)",
        pillText: "#0284c7",
      },
      dark: {
        background: ["#07111c", "#0a1b2c", "#0f3044"],
        ambientTop: ["rgba(82,195,255,0.13)", "rgba(82,195,255,0.03)", "transparent"],
        ambientBeam: ["transparent", "rgba(25,144,209,0.10)", "transparent"],
        ambientBottom: ["transparent", "rgba(37,164,229,0.08)", "rgba(37,164,229,0.02)"],
        meshBorder: "rgba(96, 177, 230, 0.10)",
        surface: "rgba(9,20,31,0.76)",
        surfaceStrong: "rgba(12,24,38,0.9)",
        surfaceBorder: "rgba(71, 181, 245, 0.18)",
        text: "#f6fbff",
        textMuted: "#d0eaf8",
        textSoft: "#8fb0c4",
        accent: "#4fc9ff",
        accentStrong: "#1aa5e8",
        accentGlow: "rgba(26, 165, 232, 0.28)",
        inputBg: "rgba(14,26,38,0.84)",
        inputBorder: "rgba(82, 195, 255, 0.20)",
        inputText: "#f6fbff",
        pillBg: "rgba(79,201,255,0.12)",
        pillBorder: "rgba(79,201,255,0.22)",
        pillText: "#9ce0ff",
      },
    },
    guard: {
      light: {
        background: ["#fbfdff", "#f0f5ff", "#e6eeff"],
        ambientTop: ["rgba(129,176,255,0.14)", "rgba(129,176,255,0.03)", "rgba(255,255,255,0.02)"],
        ambientBeam: ["transparent", "rgba(191,220,255,0.16)", "rgba(255,255,255,0.04)"],
        ambientBottom: ["rgba(255,255,255,0.02)", "rgba(207,230,255,0.18)", "rgba(239,246,255,0.22)"],
        meshBorder: "rgba(171, 196, 235, 0.18)",
        surface: "rgba(255,255,255,0.8)",
        surfaceStrong: "rgba(255,255,255,0.9)",
        surfaceBorder: "rgba(110, 152, 222, 0.16)",
        text: "#16315f",
        textMuted: "#456391",
        textSoft: "#7488ad",
        accent: "#2d68d8",
        accentStrong: "#1e4fb0",
        accentGlow: "rgba(95, 137, 215, 0.18)",
        inputBg: "rgba(255,255,255,0.92)",
        inputBorder: "rgba(129, 160, 227, 0.24)",
        inputText: "#16315f",
        pillBg: "rgba(45,104,216,0.08)",
        pillBorder: "rgba(45,104,216,0.18)",
        pillText: "#315cc7",
      },
      dark: {
        background: ["#07101e", "#0a1830", "#0f2745"],
        ambientTop: ["rgba(92,161,255,0.14)", "rgba(92,161,255,0.03)", "transparent"],
        ambientBeam: ["transparent", "rgba(29,107,201,0.08)", "transparent"],
        ambientBottom: ["transparent", "rgba(74,146,239,0.06)", "rgba(74,146,239,0.01)"],
        meshBorder: "rgba(121, 179, 255, 0.09)",
        surface: "rgba(12,22,36,0.68)",
        surfaceStrong: "rgba(8,18,33,0.9)",
        surfaceBorder: "rgba(108, 169, 255, 0.18)",
        text: "#f8fbff",
        textMuted: "#d2def6",
        textSoft: "#95a6c6",
        accent: "#59b9ff",
        accentStrong: "#1c8cff",
        accentGlow: "rgba(37, 158, 255, 0.28)",
        inputBg: "rgba(14,24,40,0.84)",
        inputBorder: "rgba(108, 169, 255, 0.18)",
        inputText: "#f8fbff",
        pillBg: "rgba(89,185,255,0.12)",
        pillBorder: "rgba(89,185,255,0.22)",
        pillText: "#9ad8ff",
      },
    },
  };

  return { mode, ...palettes[theme][mode] };
}

function useBrandTheme(theme: ThemeKey) {
  const mode = useResolvedThemeMode();
  return useMemo(() => resolveTheme(theme, mode), [theme, mode]);
}

// Kept for compatibility with login, but now intentionally subtle.
export function SwirlingConstellations() {
  const theme = useBrandTheme("guard");
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 9000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 9000, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  const positions = [
    { top: "12%", left: "10%", icon: "shield-outline" as const, size: 18, o: 0.06 },
    { top: "19%", left: "78%", icon: "scan-outline" as const, size: 18, o: 0.06 },
    { top: "44%", left: "18%", icon: "finger-print-outline" as const, size: 20, o: 0.05 },
    { top: "62%", left: "70%", icon: "lock-closed-outline" as const, size: 18, o: 0.05 },
    { top: "78%", left: "28%", icon: "document-text-outline" as const, size: 18, o: 0.04 },
  ];

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateY }] }]}>
      {positions.map((item, idx) => (
        <Ionicons
          key={idx}
          name={item.icon}
          size={item.size}
          color={theme.accent}
          style={{ position: "absolute", top: item.top as any, left: item.left as any, opacity: item.o }}
        />
      ))}
    </Animated.View>
  );
}

export function ModernScreen({ children, scroll = false, contentStyle, theme = "default" }: ScreenProps) {
  const brand = useBrandTheme(theme);
  const Container: any = scroll ? ScrollView : View;

  return (
    <View style={[styles.root, { backgroundColor: brand.background[0] }]}>
      <LinearGradient colors={brand.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={brand.ambientTop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ambientTop} />
      <LinearGradient colors={brand.ambientBeam} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ambientBeam} />
      <LinearGradient colors={brand.ambientBottom} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.ambientBottom} />
      <Container
        contentContainerStyle={scroll ? [styles.scrollContent, contentStyle] : undefined}
        style={!scroll ? [styles.content, contentStyle] : undefined}
        showsVerticalScrollIndicator={false}
      >
        {!scroll ? children : <>{children}</>}
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
  const brand = useBrandTheme("default");
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(26)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 480,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 480,
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
        {
          opacity,
          transform: [{ translateY }],
          borderColor: brand.surfaceBorder,
          backgroundColor: brand.mode === "light" ? "rgba(255,255,255,0.32)" : "rgba(8,18,30,0.32)",
          shadowColor: brand.accentGlow,
        },
        style,
      ]}
    >
      <BlurView intensity={intensity} tint={brand.mode === "dark" ? "dark" : "light"} style={[styles.glassCard, { backgroundColor: brand.surface }]}>
        {brand.mode === "light" ? <View style={styles.lightSheen} /> : null}
        {children}
      </BlurView>
    </Animated.View>
  );
}

export function TitleBlock({ title, subtitle }: { title: string; subtitle?: string }) {
  const brand = useBrandTheme("default");
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.title, { color: brand.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: brand.textSoft }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  const brand = useBrandTheme("default");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
      <ActivityIndicator size="small" color={brand.accent} />
      <Text style={[styles.subtitle, { color: brand.textSoft }]}>{label}</Text>
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "primary" | "dark" | "danger" | "light" | "aprendiz" | "guard";
  icon?: keyof typeof Ionicons.glyphMap;
  imageIcon?: ImageSourcePropType;
  glow?: boolean;
};

export function ModernButton({ label, onPress, disabled, tone = "primary", icon, imageIcon, glow = false }: ButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const brand = useBrandTheme(tone === "aprendiz" ? "aprendiz" : tone === "guard" ? "guard" : "default");

  const map = {
    primary: { colors: ["#5f7cff", "#3c5de9"], fg: "#ffffff", border: "rgba(255,255,255,0.14)" },
    dark: { colors: ["#18263d", "#0d1728"], fg: "#f8fafc", border: "rgba(255,255,255,0.08)" },
    danger: { colors: ["#f24a6b", "#d7294f"], fg: "#ffffff", border: "rgba(255,255,255,0.14)" },
    light: {
      colors: brand.mode === "dark" ? ["rgba(23,35,55,0.95)", "rgba(16,25,40,0.95)"] : ["rgba(255,255,255,0.96)", "rgba(245,249,255,0.96)"],
      fg: brand.mode === "dark" ? "#f8fafc" : "#16315f",
      border: brand.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(129,160,227,0.20)",
    },
    aprendiz: { colors: ["#23b6f6", "#0b89d1"], fg: "#ffffff", border: "rgba(255,255,255,0.14)" },
    guard: { colors: ["#3b82f6", "#1e4fd8"], fg: "#ffffff", border: "rgba(255,255,255,0.14)" },
  }[tone];

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 38, bounciness: 0 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 10 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable disabled={disabled} onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress}>
        {({ pressed }) => (
          <LinearGradient
            colors={disabled ? ["#94a3b8", "#94a3b8"] : (map.colors as any)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.button,
              {
                borderColor: disabled ? "#94a3b8" : map.border,
                opacity: pressed && !disabled ? 0.9 : 1,
                shadowColor: glow ? brand.accentGlow : tone === "light" ? "rgba(149, 168, 214, 0.16)" : brand.accentGlow,
              },
            ]}
          >
            {imageIcon ? <Image source={imageIcon} style={styles.buttonImage} /> : null}
            {!imageIcon && icon ? <Ionicons name={icon} size={20} color={disabled ? "#f8fafc" : map.fg} style={styles.buttonIcon} /> : null}
            {label ? <Text style={[styles.buttonText, { color: disabled ? "#f8fafc" : map.fg }]}>{label}</Text> : null}
          </LinearGradient>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function InputField({
  label,
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
  const brand = useBrandTheme("default");

  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.inputLabel, { color: brand.textSoft }]}>{label}</Text>
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: brand.inputBg,
            borderColor: brand.inputBorder,
            shadowColor: "transparent",
          },
          wrapperStyle,
        ]}
      >
        {imageIcon ? <Image source={imageIcon} style={styles.inputImage} /> : null}
        {!imageIcon && props.icon ? <Ionicons name={props.icon} size={20} color={iconColor ?? brand.accent} style={styles.inputIcon} /> : null}
        <TextInput
          {...props}
          placeholderTextColor={brand.textSoft}
          selectionColor={props.selectionColor ?? brand.accent}
          style={[styles.input, { color: brand.inputText }, props.style as any]}
        />
        {(rightIcon || rightImageIcon) && (
          <Pressable onPress={onRightIconPress} style={{ padding: 4 }}>
            {rightImageIcon ? (
              <Image source={rightImageIcon} style={styles.inputRightImage} />
            ) : rightIcon ? (
              <Ionicons name={rightIcon} size={22} color={rightIconColor ?? brand.textSoft} />
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
    primary: { bg: "rgba(95,124,255,0.10)", text: "#4a61d7", border: "rgba(95,124,255,0.18)" },
    warning: { bg: "rgba(245,158,11,0.10)", text: "#b45309", border: "rgba(245,158,11,0.18)" },
    success: { bg: "rgba(16,185,129,0.10)", text: "#0f8b61", border: "rgba(16,185,129,0.18)" },
    danger: { bg: "rgba(225,29,72,0.10)", text: "#be123c", border: "rgba(225,29,72,0.18)" },
    aprendiz: { bg: "rgba(14,165,233,0.10)", text: "#0284c7", border: "rgba(14,165,233,0.18)" },
    guard: { bg: "rgba(45,104,216,0.10)", text: "#315cc7", border: "rgba(45,104,216,0.18)" },
  }[tone];

  return (
    <View style={[styles.pill, { backgroundColor: map.bg, borderColor: map.border }]}>
      {imageIcon ? <Image source={imageIcon} style={styles.pillImage} /> : null}
      {!imageIcon && icon ? <Ionicons name={icon} size={14} color={map.text} style={{ marginRight: 4 }} /> : null}
      <Text style={[styles.pillText, { color: map.text }]}>{text}</Text>
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
    top: 120,
    left: -36,
    right: -36,
    height: 280,
    transform: [{ rotate: "-8deg" }],
  },
  ambientBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -10,
    height: 280,
  },
  content: {
    flex: 1,
    padding: 24,
    gap: 20,
  },
  scrollContent: {
    padding: 24,
    gap: 20,
    paddingBottom: 56,
    paddingTop: Platform.OS === "ios" ? 34 : 40,
  },
  cardContainer: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  glassCard: {
    padding: 24,
  },
  lightSheen: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    fontWeight: "600",
  },
  inputImage: {
    width: 20,
    height: 20,
    marginRight: 12,
    resizeMode: "contain",
  },
  inputRightImage: {
    width: 22,
    height: 22,
    resizeMode: "contain",
  },
  button: {
    flexDirection: "row",
    minHeight: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonImage: {
    width: 22,
    height: 22,
    marginRight: 8,
    resizeMode: "contain",
  },
  buttonText: {
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.3,
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
  pillImage: {
    width: 16,
    height: 16,
    marginRight: 4,
    resizeMode: "contain",
  },
  pillText: {
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
