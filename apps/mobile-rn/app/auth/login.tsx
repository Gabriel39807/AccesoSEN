import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { router, useLocalSearchParams } from "expo-router";

import { useSessionStore } from "../../src/store/session";
import { toUiErrorMessage } from "../../src/api/client";
import type { Jornada, Sede } from "../../src/api/turnos";
import { listSedes, type SedeItem } from "../../src/api/sedes";
import { sanitizeDigits, validateDocument6to10 } from "../../src/lib/validators";
import { isBiometricAvailable } from "../../src/auth/biometric";
import { hasRefreshToken, isBiometricEnabled } from "../../src/storage/tokens";
import { FadeInCard, InputField, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

export default function LoginScreen() {
  const params = useLocalSearchParams<{ rol?: "guarda" | "aprendiz" }>();
  const rol = (params.rol ?? "guarda") as "guarda" | "aprendiz";

  const signIn = useSessionStore((s) => s.signIn);
  const signInWithBiometric = useSessionStore((s) => s.signInWithBiometric);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  const [sede, setSede] = useState<Sede>("");
  const [sedes, setSedes] = useState<SedeItem[]>([]);
  const [jornada, setJornada] = useState<Jornada>("MAÑANA");

  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBiometricButton, setShowBiometricButton] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricHint, setBiometricHint] = useState<string | null>(null);
  const [sedeLoadHint, setSedeLoadHint] = useState<string | null>(null);

  const [lockRemainingSec, setLockRemainingSec] = useState(0);

  function onUsernameChange(value: string) {
    setUsername(sanitizeDigits(value).slice(0, 10));
  }

  function onPasswordChange(value: string) {
    setPassword(value.slice(0, 20));
  }

  const bloqueado = lockRemainingSec > 0;

  useEffect(() => {
    if (lockRemainingSec <= 0) return;
    const t = setInterval(() => {
      setLockRemainingSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [lockRemainingSec]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const items = await listSedes();
        if (!mounted) return;
        setSedes(items);
        if (!sede && items.length > 0) {
          setSede(items[0].code);
          setSedeLoadHint(null);
        }
        if (items.length === 0) {
          setSedeLoadHint("No hay sedes activas disponibles. Contacta al administrador.");
        }
      } catch {
        if (!mounted) return;
        setSedes([]);
        setSedeLoadHint("No se pudieron cargar las sedes. Revisa la conexion con el servidor.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [available, hasRefresh, enabled] = await Promise.all([
          isBiometricAvailable(),
          hasRefreshToken(),
          isBiometricEnabled(),
        ]);
        if (!mounted) return;
        setShowBiometricButton(Boolean(available));
        setBiometricReady(Boolean(available && hasRefresh && enabled));
        if (!available) setBiometricHint("Este dispositivo no tiene biometria disponible.");
        else if (!hasRefresh) setBiometricHint("La huella se habilita despues de iniciar sesion al menos una vez.");
        else if (!enabled) setBiometricHint("La huella esta desactivada para esta sesion.");
        else setBiometricHint(null);
      } catch {
        if (!mounted) return;
        setShowBiometricButton(false);
        setBiometricReady(false);
        setBiometricHint(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit() {
    setError(null);
    if (bloqueado) return;
    const documentError = validateDocument6to10(username.trim());
    if (documentError) {
      setError(documentError);
      return;
    }
    if (!password || password.length > 20) {
      setError("La contraseña debe tener maximo 20 caracteres.");
      return;
    }
    if (rol === "guarda" && !sede) {
      setError("Selecciona una sede.");
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
      setError(toUiErrorMessage(e, "No se pudo iniciar sesion."));
      const code = e?.code as string | undefined;
      const secondsRemaining = Number(e?.detail?.seconds_remaining || 0);
      if (code === "ACCOUNT_LOCKED_15MIN") {
        setLockRemainingSec(secondsRemaining > 0 ? secondsRemaining : 15 * 60);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onBiometricSubmit() {
    setError(null);
    if (bloqueado) return;
    if (rol === "guarda" && !sede) {
      setError("Selecciona una sede.");
      return;
    }

    setBiometricLoading(true);
    try {
      await signInWithBiometric({
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
      setError(toUiErrorMessage(e, "No se pudo validar la huella. Usa tu contrasena."));
    } finally {
      setBiometricLoading(false);
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
            keyboardType="number-pad"
            maxLength={10}
          />

          <InputField
            label="contraseña"
            value={password}
            onChangeText={onPasswordChange}
            placeholder="********"
            secureTextEntry={!show}
          />

          <ModernButton
            label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            tone="light"
            onPress={() => setShow((v) => !v)}
          />

          {rol === "guarda" ? (
            <View style={{ gap: 10 }}>
              <Text style={{ fontWeight: "700", color: "#0f172a" }}>Sede</Text>
              <View style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, overflow: "hidden", backgroundColor: "#f8fafc" }}>
                <Picker selectedValue={sede} onValueChange={(v) => setSede(v)}>
                  {sedes.map((item) => (
                    <Picker.Item key={item.id} label={item.name} value={item.code} />
                  ))}
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
              Bloqueado temporalmente. Intenta en {lockRemainingSec}s.
            </Text>
          ) : null}

          {error ? <Text style={{ color: "#b91c1c" }}>{error}</Text> : null}
          {rol === "guarda" && sedeLoadHint ? <Text style={{ color: "#b91c1c" }}>{sedeLoadHint}</Text> : null}

          <ModernButton
            label={loading ? "Ingresando..." : "Continuar"}
            disabled={
              loading ||
              biometricLoading ||
              bloqueado ||
              (rol === "guarda" && (!sede || sedes.length === 0))
            }
            onPress={onSubmit}
          />

          {showBiometricButton ? (
            <ModernButton
              label={biometricLoading ? "Validando huella..." : "Entrar con huella"}
              tone="light"
              disabled={
                loading ||
                biometricLoading ||
                bloqueado ||
                !biometricReady ||
                (rol === "guarda" && (!sede || sedes.length === 0))
              }
              onPress={onBiometricSubmit}
            />
          ) : null}

          {biometricHint ? <Text style={{ color: "#475569" }}>{biometricHint}</Text> : null}

          {loading || biometricLoading ? <ActivityIndicator style={{ marginTop: 4 }} /> : null}

          <ModernButton
            label="Olvide mi contraseña"
            tone="light"
            onPress={() => router.push({ pathname: "/auth/password-recovery" } as any)}
          />

          <ModernButton label="Volver" tone="dark" onPress={() => router.back()} />
        </View>
      </FadeInCard>
    </ModernScreen>
  );
}
