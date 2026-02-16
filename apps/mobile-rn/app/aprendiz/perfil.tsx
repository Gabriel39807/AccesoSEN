import React, { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { useSessionStore } from "../../src/store/session";
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

export default function AprendizPerfil() {
  const user = useSessionStore((s) => s.user);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const rules = buildPasswordRules(next, confirm);
  const allRulesValid = rules.every((rule) => rule.valid);

  async function actualizarClave() {
    setMsg(null);
    if (!allRulesValid) {
      setMsg("La nueva contrasena no cumple todos los requisitos.");
      return;
    }
    setSaving(true);
    try {
      const r = await Auth.changeInitialPassword(current, next);
      if (!r.permitido) throw new Error(r.motivo || "No se pudo actualizar.");
      setCurrent("");
      setNext("");
      setConfirm("");
      setMsg("Contrasena actualizada correctamente.");
    } catch (e: any) {
      setMsg(e?.response?.data?.message || e?.response?.data?.motivo || e?.message || "No se pudo actualizar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModernScreen scroll>
      <FadeInCard>
        <Pill text="MI PERFIL" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock title={`${user?.first_name || "-"} ${user?.last_name || ""}`.trim()} subtitle={`Documento ${user?.documento || "-"}`} />
        </View>
        <Text style={{ color: "#64748b", marginTop: 6 }}>Programa: {user?.programa_formacion || "-"}</Text>
        <Text style={{ color: "#64748b" }}>Sede: {user?.sede_principal || "-"}</Text>
      </FadeInCard>

      <FadeInCard delay={70}>
        <TitleBlock title="Cambiar contrasena" subtitle="Mantiene tu cuenta protegida." />
        <View style={{ marginTop: 8, gap: 8 }}>
          <InputField label="Contrasena actual" value={current} onChangeText={setCurrent} secureTextEntry placeholder="********" />
          <InputField label="Nueva contrasena" value={next} onChangeText={setNext} secureTextEntry placeholder="********" />
          <InputField label="Confirmar contrasena" value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="********" />

          <View style={{ borderWidth: 1, borderColor: "#dbeafe", borderRadius: 12, padding: 12, gap: 6, backgroundColor: "#f8fafc" }}>
            <Text style={{ fontWeight: "700", color: "#0f172a" }}>Checklist de seguridad</Text>
            {rules.map((rule) => (
              <Text key={rule.id} style={{ color: rule.valid ? "#15803d" : "#64748b" }}>
                {rule.valid ? "[OK]" : "[ ]"} {rule.label}
              </Text>
            ))}
          </View>

          {msg ? <Text style={{ color: msg.toLowerCase().includes("correctamente") ? "#15803d" : "#b91c1c" }}>{msg}</Text> : null}

          <ModernButton label={saving ? "Guardando..." : "Guardar cambios"} disabled={saving || !allRulesValid} onPress={actualizarClave} />
          {saving ? <ActivityIndicator style={{ marginTop: 4 }} /> : null}
        </View>
      </FadeInCard>
    </ModernScreen>
  );
}
