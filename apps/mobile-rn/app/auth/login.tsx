import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { router, useLocalSearchParams } from "expo-router";

import { useSessionStore } from "../../src/store/session";
import type { Jornada, Sede } from "../../src/api/turnos";

const MAX_INTENTOS = 3;
const BLOQUEO_SEG = 30;

export default function LoginScreen() {
  const params = useLocalSearchParams<{ rol?: "guarda" | "aprendiz" }>();
  const rol = (params.rol ?? "guarda") as "guarda" | "aprendiz";

  const signIn = useSessionStore((s) => s.signIn);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  const [sede, setSede] = useState<Sede>("CEGAFE");
  const [jornada, setJornada] = useState<Jornada>("MANANA");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [intentos, setIntentos] = useState(0);
  const [bloqueadoHasta, setBloqueadoHasta] = useState<number | null>(null);

  const now = Date.now();
  const bloqueado = bloqueadoHasta ? now < bloqueadoHasta : false;
  const restante = useMemo(() => {
    if (!bloqueadoHasta) return 0;
    return Math.max(0, Math.ceil((bloqueadoHasta - now) / 1000));
  }, [bloqueadoHasta, now]);

  async function onSubmit() {
    setError(null);

    if (bloqueado) return;

    setLoading(true);
    try {
      await signIn({
        username: username.trim(),
        password,
        rol,
        sede: rol === "guarda" ? sede : undefined,
        jornada: rol === "guarda" ? jornada : undefined,
      });
      const mustChange = useSessionStore.getState().user?.must_change_password;
      if (rol === "aprendiz" && mustChange) {
        router.replace("/auth/first-password" as any);
      } else {
        router.replace(rol === "guarda" ? ("/guard/home" as any) : ("/aprendiz/home" as any));
      }
    } catch (e: any) {
      setError(e?.message || "No se pudo iniciar sesión.");

      const next = intentos + 1;
      setIntentos(next);

      if (next >= MAX_INTENTOS) {
        setBloqueadoHasta(Date.now() + BLOQUEO_SEG * 1000);
        setIntentos(0);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 14 }}>
      <Text style={{ fontSize: 24, fontWeight: "900", textAlign: "center" }}>
        Iniciar sesión — {rol === "guarda" ? "Guarda" : "Aprendiz"}
      </Text>

      <View style={{ backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#eee", gap: 10 }}>
        <Text style={{ fontWeight: "800" }}>Usuario</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="usuario"
          autoCapitalize="none"
          style={{ borderWidth: 1, borderColor: "#eee", padding: 12, borderRadius: 12 }}
        />

        <Text style={{ fontWeight: "800" }}>Contraseña</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="********"
          secureTextEntry={!show}
          style={{ borderWidth: 1, borderColor: "#eee", padding: 12, borderRadius: 12 }}
        />

        <Pressable onPress={() => setShow((v) => !v)} style={{ paddingVertical: 6 }}>
          <Text style={{ fontWeight: "800" }}>{show ? "Ocultar" : "Mostrar"} contraseña</Text>
        </Pressable>

        {rol === "guarda" ? (
          <>
            <Text style={{ fontWeight: "800" }}>Sede</Text>
            <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 12, overflow: "hidden" }}>
              <Picker selectedValue={sede} onValueChange={(v) => setSede(v)}>
                <Picker.Item label="CEGAFE" value="CEGAFE" />
                <Picker.Item label="SANTA CLARA" value="SANTA_CLARA" />
                <Picker.Item label="ITEDRIS" value="ITEDRIS" />
                <Picker.Item label="GASTRONOMIA" value="GASTRONOMIA" />
              </Picker>
            </View>

            <Text style={{ fontWeight: "800" }}>Turno</Text>
            <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 12, overflow: "hidden" }}>
              <Picker selectedValue={jornada} onValueChange={(v) => setJornada(v)}>
                <Picker.Item label="Mañana" value="MANANA" />
                <Picker.Item label="Tarde" value="TARDE" />
                <Picker.Item label="Noche" value="NOCHE" />
              </Picker>
            </View>
          </>
        ) : null}

        {bloqueado ? (
          <Text style={{ color: "#dc2626", fontWeight: "800" }}>
            Bloqueado por intentos. Intenta en {restante}s.
          </Text>
        ) : null}

        {error ? <Text style={{ color: "#dc2626" }}>{error}</Text> : null}

        <Pressable
          disabled={loading || bloqueado}
          onPress={onSubmit}
          style={{
            marginTop: 6,
            backgroundColor: loading || bloqueado ? "#6b7280" : "#16a34a",
            padding: 14,
            borderRadius: 999,
            alignItems: "center",
          }}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>Continuar</Text>}
        </Pressable>

        <Pressable
          onPress={() => router.push({ pathname: "/auth/password-recovery" } as any)}
          style={{ paddingVertical: 10, alignItems: "center" }}
        >
          <Text style={{ opacity: 0.75, fontWeight: "800" }}>¿Olvidaste tu contraseña?</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ paddingVertical: 6, alignItems: "center" }}>
          <Text style={{ opacity: 0.7 }}>Volver</Text>
        </Pressable>
      </View>
    </View>
  );
}
