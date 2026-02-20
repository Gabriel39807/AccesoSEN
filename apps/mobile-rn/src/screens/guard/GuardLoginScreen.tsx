import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Picker } from "@react-native-picker/picker";

import { useSessionStore } from "../../store/session";
import { toUiErrorMessage } from "../../api/client";
import { Jornada, Sede } from "../../api/turnos";
import { listSedes, type SedeItem } from "../../api/sedes";
import { sanitizeDigits, validateDocument6to10 } from "../../lib/validators";

export function GuardLoginScreen() {
  const signInGuarda = useSessionStore((s) => s.signInGuarda);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [sede, setSede] = useState<Sede>("");
  const [sedes, setSedes] = useState<SedeItem[]>([]);
  const [jornada, setJornada] = useState<Jornada>("TARDE");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const items = await listSedes();
        if (!mounted) return;
        setSedes(items);
        if (items.length > 0) setSede(items[0].code);
      } catch {
        if (!mounted) return;
        setSedes([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function onUsernameChange(value: string) {
    setUsername(sanitizeDigits(value).slice(0, 10));
  }

  function onPasswordChange(value: string) {
    setPassword(value.slice(0, 20));
  }

  async function onSubmit() {
    setError(null);
    const documentError = validateDocument6to10(username.trim());
    if (documentError) {
      setError(documentError);
      return;
    }
    if (!password || password.length > 20) {
      setError("La contrasena debe tener maximo 20 caracteres.");
      return;
    }
    if (!sede) {
      setError("Selecciona una sede.");
      return;
    }

    setLoading(true);
    try {
      await signInGuarda({ username: username.trim(), password, sede, jornada });
    } catch (e: any) {
      setError(toUiErrorMessage(e, "No se pudo iniciar sesion."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "800", textAlign: "center" }}>Personal de seguridad</Text>
      <Text style={{ textAlign: "center", opacity: 0.7 }}>Ingresa tu documento y contrasena</Text>

      <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#eee" }}>
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>Documento</Text>
        <TextInput
          value={username}
          onChangeText={onUsernameChange}
          placeholder="1053444048"
          autoCapitalize="none"
          keyboardType="number-pad"
          maxLength={10}
          style={{ borderWidth: 1, borderColor: "#eee", padding: 12, borderRadius: 12 }}
        />

        <Text style={{ fontWeight: "700", marginTop: 12, marginBottom: 6 }}>Contrasena</Text>
        <TextInput
          value={password}
          onChangeText={onPasswordChange}
          placeholder="Ingresa tu contrasena"
          secureTextEntry
          style={{ borderWidth: 1, borderColor: "#eee", padding: 12, borderRadius: 12 }}
        />

        <Text style={{ fontWeight: "700", marginTop: 12, marginBottom: 6 }}>Sede</Text>
        <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 12 }}>
          <Picker selectedValue={sede} onValueChange={(v) => setSede(v)}>
            {sedes.map((item) => (
              <Picker.Item key={item.id} label={item.name} value={item.code} />
            ))}
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
          disabled={loading || !sede}
          onPress={onSubmit}
          style={{
            marginTop: 14,
            backgroundColor: loading ? "#6b7280" : "#16a34a",
            padding: 14,
            borderRadius: 999,
            alignItems: "center",
          }}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800" }}>Iniciar turno</Text>}
        </Pressable>
      </View>
    </View>
  );
}
