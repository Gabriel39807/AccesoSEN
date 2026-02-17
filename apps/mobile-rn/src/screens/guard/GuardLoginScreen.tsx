import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Picker } from "@react-native-picker/picker";

import { useSessionStore } from "../../store/session";
import { Jornada, Sede } from "../../api/turnos";

export function GuardLoginScreen() {
  const signInGuarda = useSessionStore((s) => s.signInGuarda);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [sede, setSede] = useState<Sede>("CEGAFE");
  const [jornada, setJornada] = useState<Jornada>("TARDE");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onUsernameChange(value: string) {
    setUsername(value.replace(/\D/g, "").slice(0, 10));
  }

  function onPasswordChange(value: string) {
    setPassword(value.slice(0, 20));
  }

  async function onSubmit() {
    setError(null);
    if (!/^\d{1,10}$/.test(username.trim())) {
      setError("El documento debe ser numerico y maximo de 10 digitos.");
      return;
    }
    if (!password || password.length > 20) {
      setError("La contraseña debe tener maximo 20 caracteres.");
      return;
    }

    setLoading(true);
    try {
      await signInGuarda({ username: username.trim(), password, sede, jornada });
    } catch (e: any) {
      setError(e?.message || "No se pudo iniciar sesion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "800", textAlign: "center" }}>Personal de Seguridad</Text>
      <Text style={{ textAlign: "center", opacity: 0.7 }}>Ingresa tu documento y contraseña</Text>

      <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#eee" }}>
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>Documento</Text>
        <TextInput
          value={username}
          onChangeText={onUsernameChange}
          placeholder="1053444048"
          autoCapitalize="none"
          keyboardType="number-pad"
          style={{ borderWidth: 1, borderColor: "#eee", padding: 12, borderRadius: 12 }}
        />

        <Text style={{ fontWeight: "700", marginTop: 12, marginBottom: 6 }}>contraseña</Text>
        <TextInput
          value={password}
          onChangeText={onPasswordChange}
          placeholder="Ingresa tu contraseña"
          secureTextEntry
          style={{ borderWidth: 1, borderColor: "#eee", padding: 12, borderRadius: 12 }}
        />

        <Text style={{ fontWeight: "700", marginTop: 12, marginBottom: 6 }}>Sede</Text>
        <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 12 }}>
          <Picker selectedValue={sede} onValueChange={(v) => setSede(v)}>
            <Picker.Item label="CEGAFE" value="CEGAFE" />
            <Picker.Item label="SANTA CLARA" value="SANTA_CLARA" />
            <Picker.Item label="ITEDRIS" value="ITEDRIS" />
            <Picker.Item label="GASTRONOMIA" value="GASTRONOMIA" />
          </Picker>
        </View>

        <Text style={{ fontWeight: "700", marginTop: 12, marginBottom: 6 }}>Turno</Text>
        <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 12 }}>
          <Picker selectedValue={jornada} onValueChange={(v) => setJornada(v)}>
            <Picker.Item label="Tarde" value="TARDE" />
            <Picker.Item label="Noche" value="NOCHE" />
          </Picker>
        </View>

        {error ? <Text style={{ color: "red", marginTop: 10 }}>{error}</Text> : null}

        <Pressable
          disabled={loading}
          onPress={onSubmit}
          style={{
            marginTop: 14,
            backgroundColor: loading ? "#6b7280" : "#16a34a",
            padding: 14,
            borderRadius: 999,
            alignItems: "center",
          }}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800" }}>Iniciar Turno</Text>}
        </Pressable>
      </View>
    </View>
  );
}
