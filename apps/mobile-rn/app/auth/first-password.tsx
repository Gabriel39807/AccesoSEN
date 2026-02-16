import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import * as Auth from "../../src/api/auth";

export default function FirstPasswordScreen() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit() {
    setMsg(null);
    if (next.length < 8) {
      setMsg("La nueva contrasena debe tener minimo 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      setMsg("Las contrasenas no coinciden.");
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
    <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "900", textAlign: "center" }}>Primer ingreso</Text>
      <Text style={{ textAlign: "center", opacity: 0.7 }}>
        Debes cambiar tu contrasena inicial para continuar.
      </Text>

      <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee", borderRadius: 16, padding: 16, gap: 10 }}>
        <Text style={{ fontWeight: "700" }}>Contrasena actual</Text>
        <TextInput
          value={current}
          onChangeText={setCurrent}
          placeholder="Ultimos digitos del documento"
          secureTextEntry
          style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 12 }}
        />

        <Text style={{ fontWeight: "700" }}>Nueva contrasena</Text>
        <TextInput
          value={next}
          onChangeText={setNext}
          placeholder="Minimo 8 caracteres"
          secureTextEntry
          style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 12 }}
        />

        <Text style={{ fontWeight: "700" }}>Confirmar contrasena</Text>
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Repite la nueva contrasena"
          secureTextEntry
          style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 12 }}
        />

        {msg ? <Text style={{ color: "#dc2626" }}>{msg}</Text> : null}

        <Pressable
          disabled={loading}
          onPress={onSubmit}
          style={{ backgroundColor: loading ? "#6b7280" : "#16a34a", borderRadius: 999, padding: 14, alignItems: "center", marginTop: 6 }}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>Actualizar y continuar</Text>}
        </Pressable>
      </View>
    </View>
  );
}
