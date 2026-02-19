import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import * as Auth from "../../src/api/auth";
import { toUiErrorMessage } from "../../src/api/client";
import { sanitizeDigits, validatePhone10 } from "../../src/lib/validators";
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
  const [perfil, setPerfil] = useState<Auth.AprendizPerfil | null>(null);
  const [loadingPerfil, setLoadingPerfil] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [telefono, setTelefono] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const rules = buildPasswordRules(next, confirm);
  const allRulesValid = rules.every((rule) => rule.valid);

  async function loadPerfil() {
    setLoadingPerfil(true);
    try {
      const r = await Auth.getAprendizPerfil();
      const p = r.perfil;
      setPerfil(p);
      setTelefono(p.telefono || "");
    } catch (e: any) {
      setMsg(toUiErrorMessage(e, "No se pudo cargar el perfil."));
    } finally {
      setLoadingPerfil(false);
    }
  }

  useEffect(() => {
    void loadPerfil();
  }, []);

  async function guardarTelefono() {
    setMsg(null);
    const phoneError = validatePhone10(telefono.trim());
    if (phoneError) {
      setMsg(phoneError);
      return;
    }
    setSaving(true);
    try {
      const r = await Auth.updateAprendizPerfil({ telefono: sanitizeDigits(telefono).slice(0, 10) });
      setPerfil(r.perfil);
      setTelefono(r.perfil.telefono || "");
      setMsg(r.mensaje || "Perfil actualizado.");
    } catch (e: any) {
      setMsg(toUiErrorMessage(e, "No se pudo actualizar el telefono."));
    } finally {
      setSaving(false);
    }
  }

  async function solicitarCambioCorreo() {
    setMsg(null);
    setSaving(true);
    try {
      const r = await Auth.requestAprendizEmailChange(newEmail);
      setMsg(r.mensaje || "Enviamos OTP al nuevo correo.");
    } catch (e: any) {
      setMsg(toUiErrorMessage(e, "No se pudo solicitar el cambio de correo."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmarCambioCorreo() {
    setMsg(null);
    setSaving(true);
    try {
      const r = await Auth.confirmAprendizEmailChange(newEmail, emailOtp);
      setPerfil(r.perfil);
      setNewEmail("");
      setEmailOtp("");
      setMsg(r.mensaje || "Correo actualizado.");
    } catch (e: any) {
      setMsg(toUiErrorMessage(e, "No se pudo confirmar el cambio de correo."));
    } finally {
      setSaving(false);
    }
  }

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
      await loadPerfil();
    } catch (e: any) {
      setMsg(toUiErrorMessage(e, "No se pudo actualizar la contrasena."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModernScreen scroll>
      <FadeInCard>
        <Pill text="MI PERFIL" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock
            title={loadingPerfil ? "Cargando..." : `${perfil?.first_name || "-"} ${perfil?.last_name || ""}`.trim()}
            subtitle={`Documento ${perfil?.documento || "-"}`}
          />
        </View>
        <Text style={{ color: "#64748b", marginTop: 6 }}>Correo: {perfil?.email || "-"}</Text>
        <Text style={{ color: "#64748b" }}>Programa: {perfil?.programa_formacion || "-"}</Text>
        <Text style={{ color: "#64748b" }}>Sede: {perfil?.sede_principal || "-"}</Text>
        {perfil?.pending_email_change ? (
          <Text style={{ color: "#b45309" }}>Correo pendiente: {perfil.pending_email_change}</Text>
        ) : null}
      </FadeInCard>

      <FadeInCard delay={70}>
        <TitleBlock title="Datos de contacto" subtitle="Solo puedes editar telefono y correo con OTP." />
        <View style={{ marginTop: 8, gap: 8 }}>
          <InputField
            label="Telefono"
            value={telefono}
            onChangeText={(v) => setTelefono(sanitizeDigits(v).slice(0, 10))}
            placeholder="3001234567"
            keyboardType="phone-pad"
            maxLength={10}
          />
          <ModernButton label={saving ? "Guardando..." : "Guardar telefono"} disabled={saving} onPress={guardarTelefono} />

          <InputField
            label="Nuevo correo"
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder="correo@dominio.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <ModernButton
            label={saving ? "Enviando..." : "Enviar OTP correo"}
            tone="light"
            disabled={saving || !newEmail.trim()}
            onPress={solicitarCambioCorreo}
          />

          <InputField
            label="OTP de correo"
            value={emailOtp}
            onChangeText={(v) => setEmailOtp(v.replace(/[^\d]/g, "").slice(0, 5))}
            placeholder="12345"
            keyboardType="numeric"
            maxLength={5}
          />
          <ModernButton
            label={saving ? "Confirmando..." : "Confirmar cambio de correo"}
            tone="dark"
            disabled={saving || !newEmail.trim() || emailOtp.trim().length !== 5}
            onPress={confirmarCambioCorreo}
          />
        </View>
      </FadeInCard>

      <FadeInCard delay={120}>
        <TitleBlock title="Cambiar contrasena" subtitle="Requiere contrasena actual." />
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

          {msg ? <Text style={{ color: msg.toLowerCase().includes("actualizada") ? "#15803d" : "#b91c1c" }}>{msg}</Text> : null}

          <ModernButton label={saving ? "Guardando..." : "Actualizar contrasena"} disabled={saving || !allRulesValid} onPress={actualizarClave} />
          {(saving || loadingPerfil) ? <ActivityIndicator style={{ marginTop: 4 }} /> : null}
        </View>
      </FadeInCard>
    </ModernScreen>
  );
}
