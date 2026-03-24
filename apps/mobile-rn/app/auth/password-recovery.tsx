import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import * as Auth from "../../src/api/auth";
import { toUiErrorMessage } from "../../src/api/client";
import { GuardThemeMode, guardHomeThemes } from "../../src/components/guard/GuardHomeSections";
import { useResolvedThemeMode } from "../../src/store/preferences";
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
  const mode = useResolvedThemeMode() as GuardThemeMode;
  const theme = guardHomeThemes[mode];
  const rules = buildPasswordRules(newPass, newPass2);
  const allRulesValid = rules.every((rule) => rule.valid);

  const stepCopy = useMemo(() => {
    switch (step) {
      case "email":
        return {
          pill: "RECUPERACION",
          title: "Recuperar contraseña",
          subtitle: "Ingresa el correo registrado y te enviaremos un código de verificación.",
          helper: "Te enviaremos un código al correo asociado a tu cuenta.",
        };
      case "otp":
        return {
          pill: "VERIFICACION",
          title: "Verifica tu código",
          subtitle: "Revisa tu correo e ingresa el OTP para continuar con la recuperación.",
          helper: "Ingresa el código de verificación enviado a tu correo registrado.",
        };
      case "newpass":
        return {
          pill: "SEGURIDAD",
          title: "Nueva contraseña",
          subtitle: "Crea una contraseña segura para completar la recuperación del acceso.",
          helper: "Asegúrate de cumplir todos los requisitos antes de continuar.",
        };
      case "done":
        return {
          pill: "COMPLETADO",
          title: "Acceso recuperado",
          subtitle: "Tu contraseña fue actualizada correctamente y ya puedes volver al login.",
          helper: "Usa tu nueva contraseña para ingresar de nuevo.",
        };
      default:
        return {
          pill: "RECUPERACION",
          title: "Recuperar contraseña",
          subtitle: "Ingresa el correo registrado y te enviaremos un código de verificación.",
          helper: "Te enviaremos un código al correo asociado a tu cuenta.",
        };
    }
  }, [step]);

  function onBackToLogin() {
    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/auth/login?rol=guarda" as any);
  }

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
      setMsg(toUiErrorMessage(e, "No se pudo enviar el codigo."));
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
      setMsg(toUiErrorMessage(e, "OTP invalido o expirado."));
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
      setMsg(toUiErrorMessage(e, "No se pudo cambiar la contrasena."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModernScreen scroll theme="guard" contentStyle={styles.screenContent}>
      <FadeInCard delay={0} intensity={78} style={styles.heroCard}>
        <Pill text={stepCopy.pill} tone="guard" />
        <View style={styles.heroCopy}>
          <TitleBlock title={stepCopy.title} subtitle={stepCopy.subtitle} />
          <Text style={[styles.heroSupportText, { color: theme.textSoft }]}>{stepCopy.helper}</Text>
        </View>
      </FadeInCard>

      <FadeInCard delay={70} intensity={72} style={styles.formCard}>
        <View style={styles.formStack}>
          {step === "email" ? (
            <>
              <InputField
                label="Correo registrado"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                placeholder="correo@dominio.com"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Text style={[styles.helperText, { color: theme.textSoft }]}>Te enviaremos un código al correo asociado a tu cuenta.</Text>
              <ModernButton label={loading ? "Enviando..." : "Enviar código"} tone="guard" disabled={loading} onPress={onEmail} />
            </>
          ) : null}

          {step === "otp" ? (
            <>
              <InputField
                label="Código OTP (5 dígitos)"
                icon="key-outline"
                value={otp}
                onChangeText={setOtp}
                placeholder="12345"
                keyboardType="numeric"
                maxLength={5}
                style={{ letterSpacing: 6, textAlign: "center" }}
              />
              <Text style={[styles.helperText, { color: theme.textSoft }]}>Ingresa el código de verificación que enviamos a tu correo.</Text>
              <ModernButton label={loading ? "Verificando..." : "Verificar"} tone="dark" disabled={loading} onPress={onOtp} />
            </>
          ) : null}

          {step === "newpass" ? (
            <>
              <InputField label="Nueva contraseña" icon="lock-closed-outline" value={newPass} onChangeText={setNewPass} placeholder="********" secureTextEntry />
              <InputField label="Confirmar contraseña" icon="shield-checkmark-outline" value={newPass2} onChangeText={setNewPass2} placeholder="********" secureTextEntry />

              <View
                style={[
                  styles.rulesCard,
                  {
                    borderColor: theme.summaryBorder,
                    backgroundColor: mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.54)",
                  },
                ]}
              >
                <Text style={[styles.rulesTitle, { color: theme.text }]}>Checklist de seguridad</Text>
                <View style={styles.rulesList}>
                  {rules.map((rule) => (
                    <View key={rule.id} style={styles.ruleRow}>
                      <Text style={[styles.ruleIcon, { color: rule.valid ? theme.success : theme.textSoft }]}>{rule.valid ? "●" : "○"}</Text>
                      <Text style={[styles.ruleText, { color: rule.valid ? theme.success : theme.textSoft }]}>{rule.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <ModernButton
                label={loading ? "Actualizando..." : "Cambiar contraseña"}
                tone="guard"
                disabled={loading || !allRulesValid}
                onPress={onConfirm}
              />
            </>
          ) : null}

          {step === "done" ? (
            <View style={styles.doneState}>
              <View style={[styles.doneIconWrap, { backgroundColor: mode === "dark" ? "rgba(77,226,173,0.12)" : "rgba(17,132,94,0.10)" }]}>
                <Text style={[styles.doneIcon, { color: theme.success }]}>✓</Text>
              </View>
              <Text style={[styles.doneTitle, { color: theme.text }]}>Listo</Text>
              <Text style={[styles.doneBody, { color: theme.textSoft }]}>Tu contraseña fue actualizada. Ya puedes iniciar sesión con la nueva clave.</Text>
              <ModernButton label="Volver al login" tone="guard" onPress={() => router.replace("/auth/login?rol=guarda" as any)} />
            </View>
          ) : null}

          {msg ? (
            <View
              style={[
                styles.messageCard,
                {
                  backgroundColor: msg.toLowerCase().includes("codigo") || msg.toLowerCase().includes("listo")
                    ? mode === "dark"
                      ? "rgba(77,226,173,0.10)"
                      : "rgba(17,132,94,0.08)"
                    : mode === "dark"
                      ? "rgba(248,113,113,0.10)"
                      : "rgba(220,38,38,0.08)",
                  borderColor: msg.toLowerCase().includes("codigo") || msg.toLowerCase().includes("listo")
                    ? mode === "dark"
                      ? "rgba(77,226,173,0.16)"
                      : "rgba(17,132,94,0.12)"
                    : mode === "dark"
                      ? "rgba(248,113,113,0.16)"
                      : "rgba(220,38,38,0.12)",
                },
              ]}
            >
              <Text style={{ color: msg.toLowerCase().includes("codigo") || msg.toLowerCase().includes("listo") ? theme.success : theme.warning }}>{msg}</Text>
            </View>
          ) : null}

          <View style={styles.footerActions}>
            <ModernButton label="Volver al login" tone="light" onPress={onBackToLogin} />
            {loading ? <ActivityIndicator color={theme.accentStrong} style={{ marginTop: 2 }} /> : null}
          </View>
        </View>
      </FadeInCard>
    </ModernScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: 18,
    paddingBottom: 40,
  },
  heroCard: {
    paddingTop: 6,
  },
  heroCopy: {
    marginTop: 10,
    gap: 10,
  },
  heroSupportText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    paddingRight: 8,
  },
  formCard: {
    paddingTop: 2,
  },
  formStack: {
    gap: 16,
  },
  helperText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    paddingHorizontal: 2,
  },
  rulesCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  rulesTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  rulesList: {
    gap: 8,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ruleIcon: {
    fontSize: 12,
    fontWeight: "900",
    width: 12,
    textAlign: "center",
  },
  ruleText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  doneState: {
    gap: 14,
    alignItems: "center",
    paddingVertical: 4,
  },
  doneIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  doneIcon: {
    fontSize: 30,
    fontWeight: "900",
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: "900",
  },
  doneBody: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    paddingHorizontal: 10,
  },
  messageCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  footerActions: {
    gap: 10,
  },
});
