import React, { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router } from "expo-router";
import * as Auth from "../../src/api/auth";
import { FadeInCard, InputField, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

type Step = "email" | "otp" | "newpass" | "done";
type PasswordRule = {
  id: string;
  label: string;
  valid: boolean;
};

function buildPasswordRules(password: string, confirmPassword: string): PasswordRule[] {
  return [
    { id: "len", label: "Minimo 8 caracteres", valid: password.length >= 8 },
    { id: "upper", label: "Al menos 1 mayuscula", valid: /[A-Z]/.test(password) },
    { id: "lower", label: "Al menos 1 minuscula", valid: /[a-z]/.test(password) },
    { id: "num", label: "Al menos 1 numero", valid: /[0-9]/.test(password) },
    { id: "special", label: "Al menos 1 caracter especial", valid: /[^A-Za-z0-9]/.test(password) },
    { id: "match", label: "Coincide con la confirmacion", valid: confirmPassword.length > 0 && password === confirmPassword },
  ];
}

export default function PasswordRecovery() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const rules = buildPasswordRules(newPass, newPass2);
  const allRulesValid = rules.every((rule) => rule.valid);

  async function onEmail() {
    if (!email.trim()) {
      setMsg("Ingresa un correo para enviar el OTP.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      await Auth.passwordResetRequest(email.trim().toLowerCase());
      setStep("otp");
      setMsg("Si el usuario existe, enviamos un codigo OTP por correo.");
    } catch (e: any) {
      setMsg(e?.message || e?.response?.data?.message || e?.response?.data?.motivo || "No se pudo enviar el codigo.");
    } finally {
      setLoading(false);
    }
  }

  async function onOtp() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await Auth.passwordResetVerify(email.trim().toLowerCase(), otp.trim());
      if (!r.permitido) throw new Error(r.motivo || "OTP invalido.");
      setStep("newpass");
    } catch (e: any) {
      setMsg(e?.message || e?.response?.data?.message || e?.response?.data?.motivo || "OTP invalido.");
    } finally {
      setLoading(false);
    }
  }

  async function onConfirm() {
    if (!allRulesValid) {
      setMsg("La nueva contrasena no cumple todos los requisitos.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const r = await Auth.passwordResetConfirm(email.trim().toLowerCase(), otp.trim(), newPass);
      if (!r.permitido) throw new Error(r.motivo || "No se pudo cambiar la contrasena.");
      setStep("done");
    } catch (e: any) {
      setMsg(e?.message || e?.response?.data?.message || e?.response?.data?.motivo || "No se pudo cambiar la contrasena.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModernScreen scroll>
      <FadeInCard delay={0}>
        <Pill text="RECUPERACION" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock title="Recuperar contrasena" subtitle="Completa el flujo OTP enviado a tu correo." />
        </View>
      </FadeInCard>

      <FadeInCard delay={70}>
        <View style={{ gap: 10 }}>
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
              <Text style={{ color: "#64748b" }}>El OTP se enviara al correo registrado en la cuenta.</Text>
              <ModernButton label={loading ? "Enviando..." : "Enviar codigo"} disabled={loading} onPress={onEmail} />
            </>
          ) : null}

          {step === "otp" ? (
            <>
              <InputField
                label="Codigo OTP (5 digitos)"
                value={otp}
                onChangeText={setOtp}
                placeholder="12345"
                keyboardType="numeric"
                maxLength={5}
                style={{ letterSpacing: 6, textAlign: "center" }}
              />
              <Text style={{ color: "#64748b" }}>Ingresa el codigo enviado por correo.</Text>
              <ModernButton label={loading ? "Verificando..." : "Verificar"} tone="dark" disabled={loading} onPress={onOtp} />
            </>
          ) : null}

          {step === "newpass" ? (
            <>
              <InputField label="Nueva contrasena" value={newPass} onChangeText={setNewPass} placeholder="********" secureTextEntry />
              <InputField label="Confirmar contrasena" value={newPass2} onChangeText={setNewPass2} placeholder="********" secureTextEntry />

              <View style={{ borderWidth: 1, borderColor: "#dbeafe", borderRadius: 12, padding: 12, gap: 6, backgroundColor: "#f8fafc" }}>
                <Text style={{ fontWeight: "700", color: "#0f172a" }}>Checklist de seguridad</Text>
                {rules.map((rule) => (
                  <Text key={rule.id} style={{ color: rule.valid ? "#15803d" : "#64748b" }}>
                    {rule.valid ? "[OK]" : "[ ]"} {rule.label}
                  </Text>
                ))}
              </View>

              <ModernButton
                label={loading ? "Actualizando..." : "Cambiar contrasena"}
                disabled={loading || !allRulesValid}
                onPress={onConfirm}
              />
            </>
          ) : null}

          {step === "done" ? (
            <>
              <Text style={{ textAlign: "center", fontWeight: "900", fontSize: 18, color: "#0f172a" }}>Listo</Text>
              <Text style={{ textAlign: "center", color: "#64748b" }}>
                Tu contrasena fue actualizada. Ya puedes iniciar sesion.
              </Text>
              <ModernButton label="Volver al inicio" onPress={() => router.replace("/" as any)} />
            </>
          ) : null}

          {msg ? <Text style={{ color: msg.toLowerCase().includes("listo") ? "#15803d" : "#b91c1c" }}>{msg}</Text> : null}

          <ModernButton label="Volver" tone="light" onPress={() => router.back()} />
          {loading ? <ActivityIndicator style={{ marginTop: 4 }} /> : null}
        </View>
      </FadeInCard>
    </ModernScreen>
  );
}
