import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import * as Auth from "../../src/api/auth";
import { toUiErrorMessage } from "../../src/api/client";
import { sanitizeDigits, validatePhone10 } from "../../src/lib/validators";
import { FadeInCard, InputField, ModernButton, ModernScreen, Pill, TitleBlock, uiTheme } from "../../src/ui/modern";

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

export default function AprendizPerfil() {
  const [perfil, setPerfil] = useState<Auth.AprendizPerfil | null>(null);
  const [loadingPerfil, setLoadingPerfil] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [telefono, setTelefono] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");

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
      setMsg(toUiErrorMessage(e, "No se pudo actualizar el teléfono."));
    } finally {
      setSaving(false);
    }
  }

  async function solicitarCambioCorreo() {
    setMsg(null);
    setSaving(true);
    try {
      const r = await Auth.requestAprendizEmailChange(newEmail);
      setMsg(r.mensaje || "Enviamos un código al nuevo correo.");
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
      const r = await Auth.confirmAprendizEmailChange(newEmail, emailCode);
      setPerfil(r.perfil);
      setNewEmail("");
      setEmailCode("");
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
      setMsg("La nueva contraseña no cumple todos los requisitos.");
      return;
    }
    setSaving(true);
    try {
      const r = await Auth.changeInitialPassword(current, next);
      if (!r.permitido) throw new Error(r.motivo || "No se pudo actualizar.");
      setCurrent("");
      setNext("");
      setConfirm("");
      setMsg("Contraseña actualizada correctamente.");
      await loadPerfil();
    } catch (e: any) {
      setMsg(toUiErrorMessage(e, "No se pudo actualizar la contraseña."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModernScreen scroll>
      <FadeInCard delay={0} style={{ gap: 16 }}>
        <Pill text="MI PERFIL" />
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
              <Text style={{ color: uiTheme.accentDeep, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
                Identidad del aprendiz
              </Text>
              <Text style={{ color: uiTheme.ink, fontSize: 28, lineHeight: 32, fontWeight: "900", letterSpacing: -0.8 }}>
                {loadingPerfil ? "Cargando perfil..." : `${perfil?.first_name || "-"} ${perfil?.last_name || ""}`.trim()}
              </Text>
              <Text style={{ color: uiTheme.inkSoft, lineHeight: 20 }}>
                Documento {perfil?.documento || "-"} | Programa {perfil?.programa_formacion || "-"}
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
              <Ionicons name="person-circle-outline" size={24} color={uiTheme.accentDeep} />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.62)" }}>
              <Text style={{ color: uiTheme.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>Correo</Text>
              <Text style={{ color: uiTheme.ink, fontWeight: "900", marginTop: 6 }}>{perfil?.email || "-"}</Text>
            </View>
            <View style={{ flex: 1, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.62)" }}>
              <Text style={{ color: uiTheme.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>Sede</Text>
              <Text style={{ color: uiTheme.ink, fontWeight: "900", marginTop: 6 }}>{perfil?.sede_principal || "-"}</Text>
            </View>
          </View>

          {perfil?.pending_email_change ? (
            <View style={{ borderRadius: 18, padding: 12, backgroundColor: "rgba(161,98,7,0.08)", borderWidth: 1, borderColor: "rgba(161,98,7,0.16)" }}>
              <Text style={{ color: uiTheme.warn, fontWeight: "900" }}>Correo pendiente: {perfil.pending_email_change}</Text>
            </View>
          ) : null}
        </View>
      </FadeInCard>

      <FadeInCard delay={70} style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: uiTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>Contacto</Text>
          <TitleBlock
            title="Actualiza tus datos"
            subtitle="Solo puedes editar teléfono y solicitar el cambio de correo mediante código de verificación."
          />
        </View>

        <InputField
          label="Teléfono"
          value={telefono}
          onChangeText={(v) => setTelefono(sanitizeDigits(v).slice(0, 10))}
          placeholder="3001234567"
          keyboardType="phone-pad"
          maxLength={10}
        />
        <ModernButton label={saving ? "Guardando..." : "Guardar teléfono"} disabled={saving} onPress={guardarTelefono} />

        <View style={{ borderRadius: 22, padding: 14, gap: 10, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: "rgba(148,163,184,0.22)" }}>
          <Text style={{ fontWeight: "900", color: uiTheme.ink }}>Cambio de correo con código</Text>
          <InputField
            label="Nuevo correo"
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder="correo@dominio.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <ModernButton
            label={saving ? "Enviando..." : "Enviar código al correo"}
            tone="light"
            disabled={saving || !newEmail.trim()}
            onPress={solicitarCambioCorreo}
          />

          <InputField
            label="Código de verificación"
            value={emailCode}
            onChangeText={(v) => setEmailCode(v.replace(/[^\d]/g, "").slice(0, 5))}
            placeholder="12345"
            keyboardType="numeric"
            maxLength={5}
          />
          <ModernButton
            label={saving ? "Confirmando..." : "Confirmar cambio de correo"}
            tone="dark"
            disabled={saving || !newEmail.trim() || emailCode.trim().length !== 5}
            onPress={confirmarCambioCorreo}
          />
        </View>
      </FadeInCard>

      <FadeInCard delay={120} style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: uiTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>Seguridad</Text>
          <TitleBlock
            title="Cambiar contraseña"
            subtitle="Requiere tu contraseña actual y valida la nueva con las reglas de seguridad."
          />
        </View>

        <InputField label="Contraseña actual" value={current} onChangeText={setCurrent} secureTextEntry placeholder="********" />
        <InputField label="Nueva contraseña" value={next} onChangeText={setNext} secureTextEntry placeholder="********" />
        <InputField label="Confirmar contraseña" value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="********" />

        <View style={{ borderRadius: 22, padding: 14, gap: 8, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: "rgba(148,163,184,0.22)" }}>
          <Text style={{ fontWeight: "900", color: uiTheme.ink }}>Checklist de seguridad</Text>
          {rules.map((rule) => (
            <View key={rule.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name={rule.valid ? "checkmark-circle" : "ellipse-outline"} size={18} color={rule.valid ? uiTheme.success : uiTheme.muted} />
              <Text style={{ color: rule.valid ? uiTheme.success : uiTheme.inkSoft }}>{rule.label}</Text>
            </View>
          ))}
        </View>

        {msg ? <Text style={{ color: msg.toLowerCase().includes("actualizada") || msg.toLowerCase().includes("actualizado") ? uiTheme.success : uiTheme.danger, lineHeight: 20 }}>{msg}</Text> : null}

        <ModernButton label={saving ? "Guardando..." : "Actualizar contraseña"} disabled={saving || !allRulesValid} onPress={actualizarClave} />
        {saving || loadingPerfil ? <ActivityIndicator style={{ marginTop: 4 }} color={uiTheme.accent} /> : null}
      </FadeInCard>
    </ModernScreen>
  );
}
