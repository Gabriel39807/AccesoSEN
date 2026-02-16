import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import * as Auth from "../../src/api/auth";

type Step = "email" | "otp" | "newpass" | "done";

export default function PasswordRecovery() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPass, setNewPass] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onEmail() {
    setLoading(true);
    setMsg(null);
    try {
      await Auth.passwordResetRequest(email.trim().toLowerCase());
      setStep("otp");
      setMsg("Si el usuario existe, enviamos un codigo OTP.");
    } catch (e: any) {
      setMsg(e?.response?.data?.message || e?.response?.data?.motivo || "No se pudo enviar el codigo.");
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
    <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 14 }}>
      <Text style={{ fontSize: 24, fontWeight: "900", textAlign: "center" }}>Recuperar contrasena</Text>

      <View style={{ backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#eee", gap: 10 }}>
        {step === "email" ? (
          <>
            <Text style={{ fontWeight: "800" }}>Correo</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="correo@dominio.com"
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ borderWidth: 1, borderColor: "#eee", padding: 12, borderRadius: 12 }}
            />
            <Pressable onPress={onEmail} disabled={loading} style={{ backgroundColor: "#16a34a", padding: 14, borderRadius: 999, alignItems: "center" }}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>Enviar codigo</Text>}
            </Pressable>
          </>
        ) : null}

        {step === "otp" ? (
          <>
            <Text style={{ fontWeight: "800" }}>Codigo OTP (5 digitos)</Text>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              placeholder="12345"
              keyboardType="numeric"
              maxLength={5}
              style={{ borderWidth: 1, borderColor: "#eee", padding: 12, borderRadius: 12, letterSpacing: 6, textAlign: "center" }}
            />
            <Pressable onPress={onOtp} disabled={loading} style={{ backgroundColor: "#111827", padding: 14, borderRadius: 999, alignItems: "center" }}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>Verificar</Text>}
            </Pressable>
          </>
        ) : null}

        {step === "newpass" ? (
          <>
            <Text style={{ fontWeight: "800" }}>Nueva contrasena</Text>
            <TextInput
              value={newPass}
              onChangeText={setNewPass}
              placeholder="********"
              secureTextEntry
              style={{ borderWidth: 1, borderColor: "#eee", padding: 12, borderRadius: 12 }}
            />
            <Pressable onPress={onConfirm} disabled={loading} style={{ backgroundColor: "#16a34a", padding: 14, borderRadius: 999, alignItems: "center" }}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>Cambiar contrasena</Text>}
            </Pressable>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <Text style={{ textAlign: "center", fontWeight: "900", fontSize: 18 }}>Listo</Text>
            <Text style={{ textAlign: "center", opacity: 0.7 }}>Tu contrasena fue actualizada. Ya puedes iniciar sesion.</Text>
            <Pressable onPress={() => router.replace("/" as any)} style={{ backgroundColor: "#16a34a", padding: 14, borderRadius: 999, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "900" }}>Volver al inicio</Text>
            </Pressable>
          </>
        ) : null}

        {msg ? <Text style={{ color: msg.toLowerCase().includes("listo") ? "#16a34a" : "#dc2626" }}>{msg}</Text> : null}

        <Pressable onPress={() => router.back()} style={{ paddingVertical: 6, alignItems: "center" }}>
          <Text style={{ opacity: 0.7 }}>Volver</Text>
        </Pressable>
      </View>
    </View>
  );
}
