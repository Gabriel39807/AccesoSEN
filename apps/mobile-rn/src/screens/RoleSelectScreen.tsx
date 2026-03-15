import React from "react";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AuthStackParamList } from "../navigation/AuthStack";
import { useSystemBranding } from "../theme/system-branding";
import { FadeInCard, ModernScreen, Pill, TitleBlock } from "../ui/modern";

type Props = NativeStackScreenProps<AuthStackParamList, "RoleSelect">;

const roleCards = [
  {
    label: "Personal de seguridad",
    detail: "Control de acceso, lectura QR y operacion de porteria.",
    icon: "shield-account" as const,
    border: "rgba(56, 189, 248, 0.2)",
    iconBg: "rgba(56, 189, 248, 0.15)",
    iconColor: "#38bdf8",
    enabled: true,
  },
  {
    label: "Aprendiz",
    detail: "Gestion de equipos, QR personal y seguimiento de accesos.",
    icon: "account-school" as const,
    border: "rgba(16, 185, 129, 0.2)",
    iconBg: "rgba(16, 185, 129, 0.15)",
    iconColor: "#10b981",
    enabled: false,
  },
  {
    label: "Administrador",
    detail: "Panel de gestion, permisos y configuracion institucional.",
    icon: "briefcase-account" as const,
    border: "rgba(139, 92, 246, 0.2)",
    iconBg: "rgba(139, 92, 246, 0.15)",
    iconColor: "#8b5cf6",
    enabled: false,
  },
];

export function RoleSelectScreen({ navigation }: Props) {
  const { config } = useSystemBranding();

  return (
    <ModernScreen contentStyle={{ justifyContent: "center" }}>
      <FadeInCard style={{ gap: 18 }}>
        <Pill text="ACCESO MOVIL" />
        <TitleBlock
          title="Selecciona tu rol"
          subtitle={config.nombre_institucion || "Sistema de Acceso Digital Institucional"}
        />

        {roleCards.map((card) => (
          <Pressable
            key={card.label}
            onPress={() => {
              if (!card.enabled) return;
              navigation.navigate("GuardLogin");
            }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 24,
              padding: 16,
              gap: 14,
              borderWidth: 1,
              borderColor: card.border,
              backgroundColor: "rgba(255,255,255,0.76)",
              opacity: card.enabled ? 1 : 0.6,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            })}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: card.iconBg,
              }}
            >
              <MaterialCommunityIcons name={card.icon} size={32} color={card.iconColor} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#0b1220" }}>{card.label}</Text>
              <Text style={{ fontSize: 14, color: "#64748b" }}>{card.detail}</Text>
            </View>
            <MaterialCommunityIcons name={card.enabled ? "chevron-right" : "clock-outline"} size={24} color="#64748b" />
          </Pressable>
        ))}
      </FadeInCard>
    </ModernScreen>
  );
}
