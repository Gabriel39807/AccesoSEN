import React, { useEffect, useRef, useState } from "react";
import {
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
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Image, ImageSourcePropType } from "react-native";

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  theme?: "default" | "aprendiz" | "guard";
};

// Premium Constellation Pattern - Strictly Security & Education themed
const PATTERN_ICONS: Array<keyof typeof Ionicons.glyphMap> = [
  "shield-outline", "shield-checkmark-outline", "key-outline", "lock-closed-outline",
  "finger-print-outline", "id-card-outline", "school-outline", "book-outline",
  "library-outline", "person-outline", "people-outline", "scan-outline", 
  "barcode-outline", "time-outline", "location-outline", "checkmark-circle-outline", 
  "eye-outline", "document-text-outline", "desktop-outline", "briefcase-outline"
];

export function SwirlingConstellations() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 8000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 8000, useNativeDriver: true })
      ])
    ).start();
  }, [anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -15] });
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '4deg'] });

  // Soft, ethereal, swirling clusters around center-top - Denser implementation
  const positions = [
    // Cluster 1 (Top Left)
    { top: '8%', left: '12%', icon: PATTERN_ICONS[0], size: 36, o: 0.12 },
    { top: '15%', left: '5%', icon: PATTERN_ICONS[1], size: 22, o: 0.08 },
    { top: '22%', left: '18%', icon: PATTERN_ICONS[2], size: 28, o: 0.15 },
    { top: '12%', left: '26%', icon: PATTERN_ICONS[3], size: 20, o: 0.06 },
    
    // Cluster 2 (Top Center/Right)
    { top: '5%', left: '45%', icon: PATTERN_ICONS[4], size: 40, o: 0.09 },
    { top: '10%', left: '65%', icon: PATTERN_ICONS[5], size: 26, o: 0.11 },
    { top: '18%', left: '80%', icon: PATTERN_ICONS[6], size: 32, o: 0.14 },
    { top: '8%', left: '88%', icon: PATTERN_ICONS[7], size: 24, o: 0.07 },
    
    // Cluster 3 (Mid Left)
    { top: '35%', left: '8%', icon: PATTERN_ICONS[8], size: 30, o: 0.10 },
    { top: '45%', left: '16%', icon: PATTERN_ICONS[9], size: 45, o: 0.05 },
    { top: '55%', left: '5%', icon: PATTERN_ICONS[10], size: 22, o: 0.12 },
    
    // Cluster 4 (Center swirling)
    { top: '32%', left: '35%', icon: PATTERN_ICONS[11], size: 25, o: 0.08 },
    { top: '40%', left: '60%', icon: PATTERN_ICONS[12], size: 38, o: 0.11 },
    { top: '50%', left: '45%', icon: PATTERN_ICONS[13], size: 28, o: 0.14 },
    { top: '65%', left: '35%', icon: PATTERN_ICONS[14], size: 34, o: 0.09 },
    
    // Cluster 5 (Mid Right)
    { top: '32%', left: '85%', icon: PATTERN_ICONS[15], size: 26, o: 0.13 },
    { top: '45%', left: '92%', icon: PATTERN_ICONS[16], size: 32, o: 0.07 },
    { top: '55%', left: '78%', icon: PATTERN_ICONS[17], size: 24, o: 0.10 },
    
    // Cluster 6 (Bottom scattered)
    { top: '75%', left: '15%', icon: PATTERN_ICONS[18], size: 30, o: 0.08 },
    { top: '85%', left: '25%', icon: PATTERN_ICONS[19], size: 20, o: 0.11 },
    { top: '70%', left: '55%', icon: PATTERN_ICONS[0], size: 36, o: 0.06 },
    { top: '80%', left: '70%', icon: PATTERN_ICONS[1], size: 26, o: 0.12 },
    { top: '88%', left: '85%', icon: PATTERN_ICONS[2], size: 28, o: 0.09 },
    { top: '92%', left: '45%', icon: PATTERN_ICONS[3], size: 22, o: 0.07 },
    
    // Cluster 7 (Extra ambient)
    { top: '55%', left: '25%', icon: PATTERN_ICONS[6], size: 26, o: 0.09 },
    { top: '75%', left: '45%', icon: PATTERN_ICONS[7], size: 30, o: 0.11 },
    { top: '25%', left: '55%', icon: PATTERN_ICONS[8], size: 22, o: 0.08 }
  ];

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateY }, { rotate }] }]}>
      {positions.map((item, idx) => (
        <Ionicons
          key={idx}
          name={item.icon}
          size={item.size}
          color="#94a3b8" // Slate gray pattern
          style={{
            position: "absolute",
            top: item.top as any,
            left: item.left as any,
            opacity: item.o,
          }}
        />
      ))}
    </Animated.View>
  );
}

export function ModernScreen({ children, scroll = false, contentStyle, theme = "default" }: ScreenProps) {
  const Container: any = scroll ? ScrollView : View;

  // Theme definitions for the entire screen background
  const themeStyles = {
    default: {
      gradient: ["#f8fafc", "#eef2ff", "#f8fafc"],
      orbPrimary: "rgba(99, 102, 241, 0.3)",   // Indigo
      orbSecondary: "rgba(236, 72, 153, 0.2)"  // Pink
    },
    aprendiz: {
      gradient: ["#f0f9ff", "#e0f2fe", "#f0f9ff"], // Sky blue tints
      orbPrimary: "rgba(14, 165, 233, 0.3)",   // Cyan
      orbSecondary: "rgba(56, 189, 248, 0.2)"  // Lighter Cyan
    },
    guard: {
      gradient: ["#eff6ff", "#dbeafe", "#eff6ff"], // Blue tints
      orbPrimary: "rgba(30, 58, 138, 0.25)",   // Navy Blue
      orbSecondary: "rgba(59, 130, 246, 0.2)"  // Royal Blue
    }
  }[theme];

  return (
    <View style={styles.root}>
      {/* Background Gradient */}
      <LinearGradient
        colors={themeStyles.gradient as any}
        style={StyleSheet.absoluteFill}
      />
      {theme === "guard" && <SwirlingConstellations />}
      {/* Dynamic Orbs to create depth behind the glass */}
      <View style={[styles.bgOrb, styles.bgOrbPrimary, { backgroundColor: themeStyles.orbPrimary }]} />
      <View style={[styles.bgOrb, styles.bgOrbSecondary, { backgroundColor: themeStyles.orbSecondary }]} />
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

export function FadeInCard({ children, delay = 0, style, intensity = 60 }: { children: React.ReactNode; delay?: number; style?: ViewStyle; intensity?: number }) {
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
        easing: Easing.out(Easing.back(1.5)), // Springy entrance
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

export function TitleBlock({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
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

  const map = {
    primary: { bg: "#4f46e5", fg: "#ffffff", border: "rgba(255,255,255,0.2)" },
    dark: { bg: "#0f172a", fg: "#f8fafc", border: "rgba(255,255,255,0.1)" },
    danger: { bg: "#e11d48", fg: "#ffffff", border: "rgba(255,255,255,0.2)" },
    light: { bg: "rgba(255,255,255,0.8)", fg: "#0f172a", border: "#e2e8f0" },
    aprendiz: { bg: "#0ea5e9", fg: "#ffffff", border: "rgba(255,255,255,0.2)" }, // Sky Blue / Cyan
    guard: { bg: "#1e3a8a", fg: "#ffffff", border: "rgba(255,255,255,0.2)" }, // Uniform Navy Blue
  }[tone];

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.94,
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
      <Pressable
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        {({ pressed }) => (
          <LinearGradient
            colors={
              disabled
                ? ["#cbd5e1", "#cbd5e1"]
                : tone === "primary"
                ? ["#6366f1", "#4f46e5"] // Lighter to darker indigo
                : tone === "danger"
                ? ["#f43f5e", "#e11d48"]
                : tone === "aprendiz"
                ? ["#38bdf8", "#0ea5e9"] // Light sky to dark sky
                : tone === "guard"
                ? ["#1e40af", "#172554"] // Uniform dark blue (navy)
                : tone === "dark"
                ? ["#1e293b", "#0f172a"]
                : ["#ffffff", "#f8fafc"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.button,
              {
                borderColor: disabled ? "#94a3b8" : map.border,
                opacity: pressed && !disabled ? 0.85 : 1,
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
              <Image source={imageIcon} style={{ width: 22, height: 22, marginRight: 8, resizeMode: 'contain' }} />
            ) : icon ? (
              <Ionicons
                name={icon}
                size={20}
                color={disabled ? "#f8fafc" : map.fg}
                style={[
                  { marginRight: 8 },
                  glow && !disabled ? { textShadowColor: "rgba(255,255,255,0.7)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } } : undefined
                ]}
              />
            ) : null}
            <Text 
              style={[
                styles.buttonText, 
                { color: disabled ? "#f8fafc" : map.fg },
                glow && !disabled ? { textShadowColor: "rgba(255,255,255,0.7)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } } : undefined
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

export function InputField({ label, rightIcon, onRightIconPress, iconColor, rightIconColor, imageIcon, rightImageIcon, wrapperStyle, ...props }: TextInputProps & { label: string; icon?: keyof typeof Ionicons.glyphMap; rightIcon?: keyof typeof Ionicons.glyphMap; onRightIconPress?: () => void; iconColor?: string; rightIconColor?: string; imageIcon?: ImageSourcePropType; rightImageIcon?: ImageSourcePropType; wrapperStyle?: ViewStyle }) {
  // No React state for focus - this ensures purely Native focus handling and prevents JS layout drop bugs on Android
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.inputLabel]}>{label}</Text>
      <View
        style={[
          styles.inputWrapper,
          { backgroundColor: "#ffffff", borderColor: "rgba(14, 165, 233, 0.4)" }, // Always look focused/premium
          wrapperStyle,
        ]}
      >
        {imageIcon ? (
           <Image source={imageIcon} style={{ width: 20, height: 20, marginRight: 12, resizeMode: 'contain' }} />
        ) : props.icon ? (
          <Ionicons
            name={props.icon}
            size={20}
            color={iconColor ? iconColor : "#0ea5e9"}
            style={styles.inputIcon}
          />
        ) : null}
        <TextInput
          {...props}
          placeholderTextColor="#94a3b8"
          style={[styles.input, props.style as any]}
        />
        {(rightIcon || rightImageIcon) && (
          <Pressable onPress={onRightIconPress} style={{ padding: 4 }}>
            {rightImageIcon ? (
              <Image source={rightImageIcon} style={{ width: 22, height: 22, resizeMode: 'contain' }} />
            ) : rightIcon ? (
              <Ionicons
                name={rightIcon}
                size={22}
                color={rightIconColor ? rightIconColor : "#94a3b8"}
              />
            ) : null}
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function Pill({ text, icon, imageIcon, tone = "primary" }: { text: string; icon?: keyof typeof Ionicons.glyphMap; imageIcon?: ImageSourcePropType; tone?: "primary" | "warning" | "success" | "danger" | "aprendiz" | "guard" }) {
  const map = {
    primary: { bg: "rgba(99, 102, 241, 0.15)", text: "#4338ca", border: "rgba(99, 102, 241, 0.3)" }, // Indigo
    warning: { bg: "rgba(245, 158, 11, 0.15)", text: "#b45309", border: "rgba(245, 158, 11, 0.3)" }, // Amber
    success: { bg: "rgba(16, 185, 129, 0.15)", text: "#047857", border: "rgba(16, 185, 129, 0.3)" }, // Emerald
    danger: { bg: "rgba(225, 29, 72, 0.15)", text: "#be123c", border: "rgba(225, 29, 72, 0.3)" }, // Rose
    aprendiz: { bg: "rgba(14, 165, 233, 0.15)", text: "#0369a1", border: "rgba(14, 165, 233, 0.3)" }, // Cyan
    guard: { bg: "rgba(30, 58, 138, 0.15)", text: "#1e3a8a", border: "rgba(30, 58, 138, 0.3)" }, // Navy
  }[tone];

  return (
    <View style={[styles.pill, { backgroundColor: map.bg, borderColor: map.border }]}>
      {imageIcon ? (
        <Image source={imageIcon} style={{ width: 16, height: 16, marginRight: 4, resizeMode: 'contain' }} />
      ) : icon ? (
        <Ionicons name={icon} size={14} color={map.text} style={{ marginRight: 4 }} />
      ) : null}
      <Text style={[styles.pillText, { color: map.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f8fafc",
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
    paddingTop: Platform.OS === 'ios' ? 30 : 40,
  },
  cardContainer: {
    borderRadius: 28, // Uber-rounded
    overflow: "hidden", // Crucial for BlurView corners
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.6)", // Glass reflection border
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 15 },
    elevation: Platform.OS === 'android' ? 0 : 5, // Elevation clips overflow on Android, handled securely.
    backgroundColor: Platform.OS === 'android' ? "rgba(255,255,255,0.9)" : "transparent", // Fallback for pure Android blur constraints if needed
  },
  glassCard: {
    padding: 24,
    backgroundColor: "rgba(255, 255, 255, 0.4)", // White tint over the blur
  },
  title: {
    fontSize: 32,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: "900",
    color: "#0f172a",
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
    color: "#64748b",
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9", // Subtle gray background
    borderWidth: 1,
    borderColor: "transparent", // No harsh borders normally
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  inputWrapperFocused: {
    borderColor: "rgba(14, 165, 233, 0.4)", // Safe visible border (Cyan match) instead of layer-shifting elevation
    backgroundColor: "#ffffff",
    shadowColor: "#818cf8",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    // Removed `elevation: 4` to prevent Android from unmounting the TextInput view tier on focus.
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600", // Bolder input text
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
});


