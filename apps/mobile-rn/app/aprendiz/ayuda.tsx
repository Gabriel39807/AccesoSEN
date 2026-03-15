import React from "react";
import { Linking, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { FadeInCard, ModernButton, ModernScreen, NoticeBanner, Pill, TitleBlock, uiTheme } from "../../src/ui/modern";

const faqs = [
  {
    title: "Antes del ingreso",
    detail: "Registra tus equipos y confirma que el serial coincida con el dispositivo real antes de llegar al control.",
    icon: "checkmark-done-outline" as const,
  },
  {
    title: "Si olvidaste la clave",
    detail: "Usa la recuperacion con OTP desde el login para restablecer tu acceso sin depender de terceros.",
    icon: "key-outline" as const,
  },
  {
    title: "Validacion en porteria",
    detail: "Ten listo tu QR y verifica que los equipos aprobados correspondan a los que vas a movilizar.",
    icon: "qr-code-outline" as const,
  },
];

const supportChannels = [
  {
    label: "Mesa institucional",
    detail: "Respuesta para bloqueos de acceso, correo y validacion de identidad.",
    icon: "mail-unread-outline" as const,
    action: () => Linking.openURL("mailto:soporte@institucion.local"),
  },
  {
    label: "Bienestar o coordinacion",
    detail: "Canal recomendado cuando el incidente afecta tu ingreso o permanencia en sede.",
    icon: "people-outline" as const,
    action: () => Linking.openURL("mailto:coordinacion@institucion.local"),
  },
];

export default function AprendizAyuda() {
  return (
    <ModernScreen scroll>
      <FadeInCard delay={0} style={{ gap: 16 }}>
        <Pill text="AYUDA Y SOPORTE" />
        <View
          style={{
            borderRadius: 30,
            backgroundColor: "rgba(15,23,42,0.92)",
            borderWidth: 1,
            borderColor: "rgba(15,23,42,0.16)",
            padding: 18,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={{ color: "rgba(255,255,255,0.62)", fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
                Soporte del aprendiz
              </Text>
              <Text style={{ color: "#ffffff", fontSize: 28, lineHeight: 32, fontWeight: "900", letterSpacing: -0.8 }}>
                Resuelve incidencias sin salir del flujo
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.76)", lineHeight: 20 }}>
                Consulta las pautas clave para acceso, credenciales y validacion antes de escalar un caso.
              </Text>
            </View>
            <View style={{ width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
              <Ionicons name="help-buoy-outline" size={24} color="#ffffff" />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
              <Text style={{ color: "rgba(255,255,255,0.58)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
                Prioridad
              </Text>
              <Text style={{ color: "#ffffff", fontWeight: "900", marginTop: 6 }}>Acceso y credenciales</Text>
            </View>
            <View style={{ flex: 1, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
              <Text style={{ color: "rgba(255,255,255,0.58)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
                Tiempo ideal
              </Text>
              <Text style={{ color: "#ffffff", fontWeight: "900", marginTop: 6 }}>Menos friccion en porteria</Text>
            </View>
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={70} style={{ gap: 12 }}>
        <TitleBlock title="Que revisar primero" subtitle="Empieza por los puntos que suelen resolver el problema sin abrir un caso adicional." />
        {faqs.map((faq) => (
          <View
            key={faq.title}
            style={{
              borderRadius: 22,
              padding: 14,
              backgroundColor: "rgba(255,255,255,0.78)",
              borderWidth: 1,
              borderColor: "rgba(148,163,184,0.22)",
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,118,110,0.1)" }}>
                <Ionicons name={faq.icon} size={18} color={uiTheme.accentDeep} />
              </View>
              <Text style={{ color: uiTheme.ink, fontWeight: "900", flex: 1 }}>{faq.title}</Text>
            </View>
            <Text style={{ color: uiTheme.inkSoft, lineHeight: 20 }}>{faq.detail}</Text>
          </View>
        ))}
      </FadeInCard>

      <FadeInCard delay={120} style={{ gap: 12 }}>
        <TitleBlock title="Canales de soporte" subtitle="Escala por el canal correcto segun el tipo de incidencia para reducir tiempos de respuesta." />
        <NoticeBanner tone="info" text="Si el problema es solo de acceso, intenta primero recuperar tu clave o regenerar el QR antes de reportarlo." />
        {supportChannels.map((channel) => (
          <View
            key={channel.label}
            style={{
              borderRadius: 22,
              padding: 14,
              backgroundColor: "rgba(255,255,255,0.78)",
              borderWidth: 1,
              borderColor: "rgba(148,163,184,0.22)",
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,23,42,0.08)" }}>
                <Ionicons name={channel.icon} size={18} color={uiTheme.navy} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: uiTheme.ink, fontWeight: "900" }}>{channel.label}</Text>
                <Text style={{ color: uiTheme.inkSoft, lineHeight: 18 }}>{channel.detail}</Text>
              </View>
            </View>
            <ModernButton label={`Contactar ${channel.label}`} icon={channel.icon} tone="dark" onPress={channel.action} />
          </View>
        ))}
      </FadeInCard>
    </ModernScreen>
  );
}
