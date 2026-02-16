import React, { useEffect, useRef } from "react";
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
} from "react-native";

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
};

export function ModernScreen({ children, scroll = false, contentStyle }: ScreenProps) {
  const Container: any = scroll ? ScrollView : View;
  return (
    <View style={styles.root}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />
      <Container
        contentContainerStyle={scroll ? [styles.scrollContent, contentStyle] : undefined}
        style={!scroll ? [styles.content, contentStyle] : undefined}
      >
        {!scroll ? children : <>{children}</>}
      </Container>
    </View>
  );
}

export function FadeInCard({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
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
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
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
  tone?: "primary" | "dark" | "danger" | "light";
};

export function ModernButton({ label, onPress, disabled, tone = "primary" }: ButtonProps) {
  const map = {
    primary: { bg: "#0f766e", fg: "#ffffff" },
    dark: { bg: "#0f172a", fg: "#ffffff" },
    danger: { bg: "#b91c1c", fg: "#ffffff" },
    light: { bg: "#e2e8f0", fg: "#0f172a" },
  }[tone];

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: disabled ? "#94a3b8" : map.bg, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color: map.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function InputField({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#64748b"
        style={[styles.input, props.style as any]}
      />
    </View>
  );
}

export function Pill({ text }: { text: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  bgOrbTop: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(20,184,166,0.16)",
    top: -90,
    right: -70,
  },
  bgOrbBottom: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(15,23,42,0.08)",
    bottom: -110,
    left: -80,
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 13,
    color: "#475569",
  },
  inputLabel: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#f8fafc",
    color: "#0f172a",
  },
  button: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    paddingHorizontal: 18,
    shadowColor: "#0f172a",
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  buttonText: {
    fontWeight: "900",
    fontSize: 14,
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "#ccfbf1",
    borderColor: "#99f6e4",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    color: "#115e59",
    fontWeight: "800",
    fontSize: 11,
  },
});

