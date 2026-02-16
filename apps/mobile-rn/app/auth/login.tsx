import React, { useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { router, useLocalSearchParams } from "expo-router";

import { useSessionStore } from "../../src/store/session";
import type { Jornada, Sede } from "../../src/api/turnos";
import { FadeInCard, InputField, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

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
  const [jornada, setJornada] = useState<Jornada>("MAÑANA");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [intentos, setIntentos] = useState(0);
  const [bloqueadoHasta, setBloqueadoHasta] = useState<number | null>(null);

  function onUsernameChange(value: string) {
    setUsername(value.replace(/\D/g, "").slice(0, 10));
  }

  function onPasswordChange(value: string) {
    setPassword(value.slice(0, 20));
  }

  const now = Date.now();
  const bloqueado = bloqueadoHasta ? now < bloqueadoHasta : false;
  const restante = useMemo(() => {
    if (!bloqueadoHasta) return 0;
    return Math.max(0, Math.ceil((bloqueadoHasta - now) / 1000));
  }, [bloqueadoHasta, now]);

  async function onSubmit() {
    setError(null);
    if (bloqueado) return;
    if (!/^\d{1,10}$/.test(username.trim())) {
      setError("El documento debe ser numerico y maximo de 10 digitos.");
      return;
    }
    if (!password || password.length > 20) {
      setError("La contrasena debe tener maximo 20 caracteres.");
      return;
    }

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
      setError(e?.message || "No se pudo iniciar sesion.");
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
    <ModernScreen scroll>
      <FadeInCard delay={0}>
        <Pill text={rol === "guarda" ? "SEGURIDAD" : "APRENDIZ"} />
        <View style={{ marginTop: 8 }}>
          <TitleBlock title="Iniciar sesion" subtitle={rol === "guarda" ? "Controla accesos y turnos activos." : "Consulta tu estado, equipos y mi QR."} />
        </View>
      </FadeInCard>

      <FadeInCard delay={70}>
        <View style={{ gap: 10 }}>
          <InputField
            label="Documento"
            value={username}
            onChangeText={onUsernameChange}
            autoCapitalize="none"
            placeholder="1053444048"
          />

          <InputField
            label="Contrasena"
            value={password}
            onChangeText={onPasswordChange}
            placeholder="********"
            secureTextEntry={!show}
          />

          <ModernButton
            label={show ? "Ocultar contrasena" : "Mostrar contrasena"}
            tone="light"
            onPress={() => setShow((v) => !v)}
          />

          {rol === "guarda" ? (
            <View style={{ gap: 10 }}>
              <Text style={{ fontWeight: "700", color: "#0f172a" }}>Sede</Text>
              <View style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, overflow: "hidden", backgroundColor: "#f8fafc" }}>
                <Picker selectedValue={sede} onValueChange={(v) => setSede(v)}>
                  <Picker.Item label="CEGAFE" value="CEGAFE" />
                  <Picker.Item label="SANTA CLARA" value="SANTA_CLARA" />
                  <Picker.Item label="ITEDRIS" value="ITEDRIS" />
                  <Picker.Item label="GASTRONOMIA" value="GASTRONOMIA" />
                </Picker>
              </View>

              <Text style={{ fontWeight: "700", color: "#0f172a" }}>Turno</Text>
              <View style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, overflow: "hidden", backgroundColor: "#f8fafc" }}>
                <Picker selectedValue={jornada} onValueChange={(v) => setJornada(v)}>
                  <Picker.Item label="MAÑANA" value="MAÑANA" />
                  <Picker.Item label="Tarde" value="TARDE" />
                  <Picker.Item label="Noche" value="NOCHE" />
                </Picker>
              </View>
            </View>
          ) : null}

          {bloqueado ? (
            <Text style={{ color: "#b91c1c", fontWeight: "800" }}>
              Bloqueado temporalmente. Intenta en {restante}s.
            </Text>
          ) : null}

          {error ? <Text style={{ color: "#b91c1c" }}>{error}</Text> : null}

          <ModernButton
            label={loading ? "Ingresando..." : "Continuar"}
            disabled={loading || bloqueado}
            onPress={onSubmit}
          />

          {loading ? <ActivityIndicator style={{ marginTop: 4 }} /> : null}

          <ModernButton
            label="Olvide mi contrasena"
            tone="light"
            onPress={() => router.push({ pathname: "/auth/password-recovery" } as any)}
          />

          <ModernButton label="Volver" tone="dark" onPress={() => router.back()} />
        </View>
      </FadeInCard>
    </ModernScreen>
  );
}
