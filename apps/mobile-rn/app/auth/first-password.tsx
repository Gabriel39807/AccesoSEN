import React, { useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import * as Auth from "../../src/api/auth";
import { toUiErrorMessage } from "../../src/api/client";
import {
  FadeInCard,
  InputField,
  LoadingBlock,
  ModernButton,
  ModernScreen,
  NoticeBanner,
  Pill,
  TitleBlock,
  uiTheme,
} from "../../src/ui/modern";

type PasswordRule = {
  id: string;
  label: string;
  valid: boolean;
};

function buildPasswordRules(password: string, confirmPassword: string): PasswordRule[] {
  return [
    { id: "len", label: "Mínimo 8 caracteres", valid: password.length >= 8 },
    { id: "upper", label: "Al menos 1 mayúscula", valid: /[A-Z]/.test(password) },
    { id: "lower", label: "Al menos 1 minúscula", valid: /[a-z]/.test(password) },
    { id: "num", label: "Al menos 1 número", valid: /[0-9]/.test(password) },
    { id: "special", label: "Al menos 1 carácter especial", valid: /[^A-Za-z0-9]/.test(password) },
    { id: "match", label: "Coincide con la confirmación", valid: confirmPassword.length > 0 && password === confirmPassword },
  ];
}

const safetyPillars = [
  { title: "Personal", detail: "Tu nueva clave reemplaza la temporal." },
  { title: "Robusta", detail: "Debe cumplir reglas de seguridad claras." },
  { title: "Privada", detail: "No compartas esta clave con terceros." },
];

export default function FirstPasswordScreen() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const rules = buildPasswordRules(next, confirm);
  const allRulesValid = rules.every((rule) => rule.valid);
  const msgTone = msg?.toLowerCase().includes("actualizada") ? "success" : "danger";

  async function onSubmit() {
    setMsg(null);
    if (!allRulesValid) {
      setMsg("La nueva contraseña no cumple todos los requisitos.");
      return;
    }

    setLoading(true);
    try {
      const r = await Auth.changeInitialPassword(current, next);
      if (!r.permitido) throw new Error(r.motivo || "No se pudo actualizar.");
      setMsg("Clave actualizada correctamente. Redirigiendo al inicio.");
      router.replace("/aprendiz/home" as any);
    } catch (e: any) {
      setMsg(toUiErrorMessage(e, "No se pudo actualizar."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModernScreen scroll>
      <FadeInCard delay={0} style={{ gap: 16 }}>
        <Pill text="PRIMER ACCESO" />
        <View
          style={{
            borderRadius: 30,
            backgroundColor: "rgba(15,118,110,0.1)",
            borderWidth: 1,
            borderColor: "rgba(15,118,110,0.16)",
            padding: 18,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text
                style={{
                  color: uiTheme.accentDeep,
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                Activación de cuenta
              </Text>
              <Text
                style={{
                  color: uiTheme.ink,
                  fontSize: 28,
                  lineHeight: 32,
                  fontWeight: "900",
                  letterSpacing: -0.8,
                }}
              >
                Actualiza tu clave inicial
              </Text>
              <Text style={{ color: uiTheme.inkSoft, lineHeight: 20 }}>
                Antes de continuar, reemplaza la contraseña temporal por una personal y segura para completar tu ingreso.
              </Text>
            </View>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.62)",
                borderWidth: 1,
                borderColor: "rgba(15,118,110,0.12)",
              }}
            >
              <Ionicons name="lock-closed-outline" size={24} color={uiTheme.accentDeep} />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {safetyPillars.map((item) => (
              <View key={item.title} style={{ flex: 1, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.62)" }}>
                <Text style={{ color: uiTheme.ink, fontWeight: "900", fontSize: 14 }}>{item.title}</Text>
                <Text style={{ color: uiTheme.inkSoft, fontSize: 12, marginTop: 6, lineHeight: 17 }}>{item.detail}</Text>
              </View>
            ))}
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={70} style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text
            style={{
              color: uiTheme.muted,
              fontSize: 12,
              fontWeight: "800",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Cambio obligatorio
          </Text>
          <TitleBlock
            title="Configura tu nueva contraseña"
            subtitle="Usa una clave que cumpla todos los requisitos y confirme tu identidad."
          />
        </View>

        <InputField
          label="Contraseña actual"
          value={current}
          onChangeText={(v) => setCurrent(v.slice(0, 20))}
          placeholder="Últimos dígitos del documento"
          secureTextEntry
        />

        <InputField
          label="Nueva contraseña"
          value={next}
          onChangeText={(v) => setNext(v.slice(0, 20))}
          placeholder="Mínimo 8 caracteres"
          secureTextEntry
        />

        <InputField
          label="Confirmar contraseña"
          value={confirm}
          onChangeText={(v) => setConfirm(v.slice(0, 20))}
          placeholder="Repite la nueva contraseña"
          secureTextEntry
        />

        <View
          style={{
            borderRadius: 22,
            padding: 14,
            gap: 8,
            backgroundColor: "rgba(255,255,255,0.72)",
            borderWidth: 1,
            borderColor: "rgba(148,163,184,0.22)",
          }}
        >
          <Text style={{ fontWeight: "900", color: uiTheme.ink }}>Checklist de seguridad</Text>
          {rules.map((rule) => (
            <View key={rule.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons
                name={rule.valid ? "checkmark-circle" : "ellipse-outline"}
                size={18}
                color={rule.valid ? uiTheme.success : uiTheme.muted}
              />
              <Text style={{ color: rule.valid ? uiTheme.success : uiTheme.inkSoft }}>{rule.label}</Text>
            </View>
          ))}
        </View>

        {msg ? <NoticeBanner tone={msgTone} text={msg} /> : null}

        <ModernButton
          label={loading ? "Actualizando..." : "Actualizar y continuar"}
          disabled={loading || !allRulesValid}
          onPress={onSubmit}
        />

        {loading ? <LoadingBlock label="Actualizando credenciales iniciales" /> : null}
      </FadeInCard>
    </ModernScreen>
  );
}
