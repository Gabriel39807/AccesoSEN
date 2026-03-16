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
  uiTheme,
} from "../../src/ui/modern";

type Step = "email" | "code" | "newpass" | "done";
type PasswordRule = {
  id: string;
  label: string;
  valid: boolean;
};

const stepMeta: Record<Step, { index: number; title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }> = {
  email: {
    index: 1,
    title: "Recupera tu acceso",
    subtitle: "Inicia el flujo con el correo registrado en tu cuenta.",
    icon: "mail-unread-outline",
  },
  code: {
    index: 2,
    title: "Verifica el código",
    subtitle: "Confirma el código enviado para validar tu identidad.",
    icon: "shield-checkmark-outline",
  },
  newpass: {
    index: 3,
    title: "Define una nueva clave",
    subtitle: "Crea una contraseña robusta y consistente con los requisitos.",
    icon: "key-outline",
  },
  done: {
    index: 4,
    title: "Listo",
    subtitle: "Tu acceso se actualizó correctamente y ya puedes volver a entrar.",
    icon: "checkmark-done-outline",
  },
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

function StepRail({ activeStep }: { activeStep: Step }) {
  const steps: Step[] = ["email", "code", "newpass", "done"];
  const currentIndex = stepMeta[activeStep].index;

  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {steps.map((step) => {
        const isActive = step === activeStep;
        const isDone = stepMeta[step].index < currentIndex;
        return (
          <View
            key={step}
            style={{
              flex: 1,
              borderRadius: 999,
              height: 8,
              backgroundColor: isActive || isDone ? uiTheme.accent : "rgba(148,163,184,0.22)",
            }}
          />
        );
      })}
    </View>
  );
}

export default function PasswordRecovery() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const rules = buildPasswordRules(newPass, newPass2);
  const allRulesValid = rules.every((rule) => rule.valid);
  const currentMeta = stepMeta[step];
  const msgTone = msg?.toLowerCase().includes("enviamos") || msg?.toLowerCase().includes("listo") ? "success" : "danger";

  async function onEmail() {
    if (!email.trim()) {
      setMsg("Ingresa un correo para enviar el código.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      await Auth.passwordResetRequest(email.trim().toLowerCase());
      setStep("code");
      setMsg("Si el usuario existe, enviamos un código de verificación por correo.");
    } catch (e: any) {
      setMsg(toUiErrorMessage(e, "No se pudo enviar el código."));
    } finally {
      setLoading(false);
    }
  }

  async function onCode() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await Auth.passwordResetVerify(email.trim().toLowerCase(), code.trim());
      if (!r.permitido) throw new Error(r.motivo || "Código inválido.");
      setStep("newpass");
    } catch (e: any) {
      setMsg(toUiErrorMessage(e, "Código inválido o vencido."));
    } finally {
      setLoading(false);
    }
  }

  async function onConfirm() {
    if (!allRulesValid) {
      setMsg("La nueva contraseña no cumple todos los requisitos.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const r = await Auth.passwordResetConfirm(email.trim().toLowerCase(), code.trim(), newPass);
      if (!r.permitido) throw new Error(r.motivo || "No se pudo cambiar la contraseña.");
      setStep("done");
      setMsg("Listo. Tu acceso fue recuperado correctamente.");
    } catch (e: any) {
      setMsg(toUiErrorMessage(e, "No se pudo cambiar la contraseña."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModernScreen scroll>
      <FadeInCard delay={0} style={{ gap: 16 }}>
        <Pill text="RECUPERACIÓN" />
        <StepRail activeStep={step} />

        <View
          style={{
            borderRadius: 30,
            backgroundColor: "rgba(15,23,42,0.92)",
            borderWidth: 1,
            borderColor: "rgba(15,23,42,0.16)",
            padding: 18,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text
                style={{
                  color: "rgba(255,255,255,0.62)",
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                Paso {currentMeta.index} de 4
              </Text>
              <Text
                style={{
                  color: "#ffffff",
                  fontSize: 28,
                  lineHeight: 32,
                  fontWeight: "900",
                  letterSpacing: -0.8,
                }}
              >
                {currentMeta.title}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.76)", lineHeight: 20 }}>{currentMeta.subtitle}</Text>
            </View>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.08)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
              }}
            >
              <Ionicons name={currentMeta.icon} size={24} color="#ffffff" />
            </View>
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={70} style={{ gap: 14 }}>
        {step === "email" ? (
          <>
            <InputField
              label="Correo"
              value={email}
              onChangeText={setEmail}
              placeholder="correo@dominio.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View
              style={{
                borderRadius: 20,
                padding: 14,
                backgroundColor: "rgba(15,118,110,0.08)",
                borderWidth: 1,
                borderColor: "rgba(15,118,110,0.14)",
              }}
            >
              <Text style={{ color: uiTheme.inkSoft, lineHeight: 20 }}>
                El código se enviará al correo registrado en la cuenta. Si no existe una cuenta asociada, no se revelará esa información.
              </Text>
            </View>
            <ModernButton label={loading ? "Enviando..." : "Enviar código"} disabled={loading} onPress={onEmail} />
          </>
        ) : null}

        {step === "code" ? (
          <>
            <InputField
              label="Código de verificación"
              value={code}
              onChangeText={setCode}
              placeholder="12345"
              keyboardType="numeric"
              maxLength={5}
              style={{ letterSpacing: 6, textAlign: "center", fontWeight: "900" as const }}
            />
            <View
              style={{
                borderRadius: 20,
                padding: 14,
                backgroundColor: "rgba(255,255,255,0.72)",
                borderWidth: 1,
                borderColor: "rgba(148,163,184,0.22)",
              }}
            >
              <Text style={{ color: uiTheme.inkSoft, lineHeight: 20 }}>
                Ingresa el código recibido y continúa con la validación segura del flujo de recuperación.
              </Text>
            </View>
            <ModernButton
              label={loading ? "Verificando..." : "Verificar código"}
              tone="dark"
              disabled={loading}
              onPress={onCode}
            />
          </>
        ) : null}

        {step === "newpass" ? (
          <>
            <InputField label="Nueva contraseña" value={newPass} onChangeText={setNewPass} placeholder="********" secureTextEntry />
            <InputField
              label="Confirmar contraseña"
              value={newPass2}
              onChangeText={setNewPass2}
              placeholder="********"
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

            <ModernButton
              label={loading ? "Actualizando..." : "Cambiar contraseña"}
              disabled={loading || !allRulesValid}
              onPress={onConfirm}
            />
          </>
        ) : null}

        {step === "done" ? (
          <>
            <View
              style={{
                borderRadius: 24,
                padding: 18,
                backgroundColor: "rgba(15,118,110,0.08)",
                borderWidth: 1,
                borderColor: "rgba(15,118,110,0.16)",
                gap: 10,
              }}
            >
              <Text style={{ color: uiTheme.ink, fontWeight: "900", fontSize: 20, textAlign: "center" }}>
                Tu contraseña fue actualizada
              </Text>
              <Text style={{ color: uiTheme.inkSoft, textAlign: "center", lineHeight: 20 }}>
                Ya puedes volver al inicio de sesión e ingresar con tu nueva clave.
              </Text>
            </View>
            <ModernButton label="Volver al inicio" onPress={() => router.replace("/" as any)} />
          </>
        ) : null}

        {msg ? <NoticeBanner tone={msgTone} text={msg} /> : null}
        <ModernButton label="Volver" tone="light" onPress={() => router.back()} />
        {loading ? <LoadingBlock label={`Procesando paso ${currentMeta.index} de recuperación`} /> : null}
      </FadeInCard>
    </ModernScreen>
  );
}
