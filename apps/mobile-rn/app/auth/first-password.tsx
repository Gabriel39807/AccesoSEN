import React, { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router } from "expo-router";

import * as Auth from "../../src/api/auth";
import { FadeInCard, InputField, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

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

export default function FirstPasswordScreen() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const rules = buildPasswordRules(next, confirm);
  const allRulesValid = rules.every((rule) => rule.valid);

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
      router.replace("/aprendiz/home" as any);
    } catch (e: any) {
      setMsg(e?.response?.data?.message || e?.response?.data?.motivo || e?.message || "No se pudo actualizar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModernScreen scroll>
      <FadeInCard delay={0}>
        <Pill text="PRIMER ACCESO" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock title="Actualiza tu clave" subtitle="Para continuar, cambia tu contraseña temporal por una personal y segura." />
        </View>
      </FadeInCard>

      <FadeInCard delay={70}>
        <View style={{ gap: 10 }}>
          <InputField
            label="Contraseña actual"
            value={current}
            onChangeText={(v) => setCurrent(v.slice(0, 20))}
            placeholder="Ultimos digitos del documento"
            secureTextEntry
          />

          <InputField
            label="Nueva contraseña"
            value={next}
            onChangeText={(v) => setNext(v.slice(0, 20))}
            placeholder="Minimo 8 caracteres"
            secureTextEntry
          />

          <InputField
            label="Confirmar contraseña"
            value={confirm}
            onChangeText={(v) => setConfirm(v.slice(0, 20))}
            placeholder="Repite la nueva contraseña"
            secureTextEntry
          />

          <View style={{ borderWidth: 1, borderColor: "#dbeafe", borderRadius: 12, padding: 12, gap: 6, backgroundColor: "#f8fafc" }}>
            <Text style={{ fontWeight: "700", color: "#0f172a" }}>Checklist de seguridad</Text>
            {rules.map((rule) => (
              <Text key={rule.id} style={{ color: rule.valid ? "#15803d" : "#64748b" }}>
                {rule.valid ? "[OK]" : "[ ]"} {rule.label}
              </Text>
            ))}
          </View>

          {msg ? <Text style={{ color: "#b91c1c" }}>{msg}</Text> : null}

          <ModernButton
            label={loading ? "Actualizando..." : "Actualizar y continuar"}
            disabled={loading || !allRulesValid}
            onPress={onSubmit}
          />

          {loading ? <ActivityIndicator style={{ marginTop: 4 }} /> : null}
        </View>
      </FadeInCard>
    </ModernScreen>
  );
}
