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
  const [jornada, setJornada] = useState<Jornada>("MAÑANA");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signInGuarda({ username: username.trim(), password, sede, jornada });
      // No navegamos manual: App cambia de stack cuando user.rol == guarda
    } catch (e: any) {
      setError(e?.message || "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "800", textAlign: "center" }}>
        Personal de Seguridad
      </Text>
      <Text style={{ textAlign: "center", opacity: 0.7 }}>Ingresa tu usuario y contraseña</Text>

      <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#eee" }}>
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>Usuario</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="guardia.carlos"
          autoCapitalize="none"
          style={{ borderWidth: 1, borderColor: "#eee", padding: 12, borderRadius: 12 }}
        />

        <Text style={{ fontWeight: "700", marginTop: 12, marginBottom: 6 }}>Contraseña</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Ingresa tu contraseña"
          secureTextEntry
          style={{ borderWidth: 1, borderColor: "#eee", padding: 12, borderRadius: 12 }}
        />

        {/* Backend requiere sede + jornada */}
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
            <Picker.Item label="Mañana" value="MAÑANA" />
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

        <Text style={{ textAlign: "center", marginTop: 12, opacity: 0.6 }}>
          Importante: Recuerda registrar tu salida al finalizar el turno
        </Text>
      </View>
    </View>
  );
}
