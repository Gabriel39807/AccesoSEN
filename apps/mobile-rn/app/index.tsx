import React from "react";
import { Pressable, Text, View, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useSessionStore } from "../src/store/session";
import { useSystemBranding } from "../src/theme/system-branding";
import { FadeInCard, ModernScreen } from "../src/ui/modern";

const roleCards = [
  {
    label: "Personal de Seguridad",
    detail: "Control de acceso, lectura de códigos QR y alertas",
    icon: "shield-account" as const,
    border: "rgba(56, 189, 248, 0.2)",
    iconBg: "rgba(56, 189, 248, 0.15)",
    iconColor: "#38bdf8",
    path: { pathname: "/auth/login", params: { rol: "guarda" } } as const,
  },
  {
    label: "Aprendiz",
    detail: "Gestión de pases, solicitud de ingresos y equipos",
    icon: "account-school" as const,
    border: "rgba(16, 185, 129, 0.2)",
    iconBg: "rgba(16, 185, 129, 0.15)",
    iconColor: "#10b981",
    path: { pathname: "/auth/login", params: { rol: "aprendiz" } } as const,
  },
];

export default function RoleSelection() {
  const user = useSessionStore((s) => s.user);
  const { config } = useSystemBranding();

  React.useEffect(() => {
    if (user?.rol === "guarda") router.replace({ pathname: "/guard/home" } as any);
    if (user?.rol === "aprendiz") {
      if (user?.must_change_password) router.replace({ pathname: "/auth/first-password" } as any);
      else router.replace({ pathname: "/aprendiz/home" } as any);
    }
  }, [user]);

  return (
    <ModernScreen scroll={false} contentStyle={styles.screenContent}>
      <FadeInCard delay={0} style={styles.header}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="shield-check" size={54} color="#38bdf8" />
        </View>
        <Text style={styles.title}>S.A.D.I.</Text>
        <Text style={styles.subtitle}>
          {config.nombre_institucion || "Sistema de Acceso Digital Institucional"}
        </Text>
      </FadeInCard>

      <FadeInCard delay={100} style={styles.cardsContainer}>
        <Text style={styles.sectionTitle}>Selecciona tu rol</Text>

        {roleCards.map((card) => (
          <Pressable
            key={card.label}
            onPress={() => router.push(card.path as any)}
            style={({ pressed }) => [
              styles.card,
              { borderColor: card.border },
              { transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <View style={[styles.cardIconWrapper, { backgroundColor: card.iconBg }]}>
              <MaterialCommunityIcons name={card.icon} size={32} color={card.iconColor} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{card.label}</Text>
              <Text style={styles.cardDescription}>{card.detail}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#64748b" />
          </Pressable>
        ))}

        <Pressable
          style={[
            styles.card,
            styles.cardDisabled,
            { borderColor: "rgba(139, 92, 246, 0.2)" },
          ]}
        >
          <View style={[styles.cardIconWrapper, { backgroundColor: "rgba(139, 92, 246, 0.15)" }]}>
            <MaterialCommunityIcons name="briefcase-account" size={32} color="#8b5cf6" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Administrador</Text>
            <Text style={styles.cardDescription}>Panel de gestión y métricas web</Text>
          </View>
          <MaterialCommunityIcons name="clock-outline" size={24} color="#64748b" />
        </Pressable>
      </FadeInCard>
    </ModernScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
    paddingVertical: 50,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  iconContainer: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: 1,
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    fontWeight: "500",
    paddingHorizontal: 10,
  },
  cardsContainer: {
    width: "100%",
  },
  sectionTitle: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "600",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardDisabled: {
    opacity: 0.6,
  },
  cardIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
    paddingRight: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "500",
    lineHeight: 18,
  },
});
