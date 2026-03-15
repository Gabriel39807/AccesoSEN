/**
 * Login movil para roles aprendiz/guarda.
 *
 * Responsabilidad:
 * - Validar credenciales y sede/turno para guardas.
 * - Exponer acceso con biometria cuando existe sesion persistida.
 * - Mantener feedback visual de carga/error durante todo el flujo.
 */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { useSessionStore } from "../../src/store/session";
import { toUiErrorMessage } from "../../src/api/client";
import type { Jornada, Sede } from "../../src/api/turnos";
import { listSedes, type SedeItem } from "../../src/api/sedes";
import { sanitizeDigits, validateDocument6to10 } from "../../src/lib/validators";
import { isBiometricAvailable } from "../../src/auth/biometric";
import { hasRefreshToken, isBiometricEnabled } from "../../src/storage/tokens";
import { FadeInCard, InputField, ModernButton, ModernScreen, Pill, TitleBlock, uiTheme } from "../../src/ui/modern";

type RoleKey = "guarda" | "aprendiz";

type RoleContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  featureA: string;
  featureB: string;
  accentBg: string;
  accentBorder: string;
  accentIcon: keyof typeof Ionicons.glyphMap;
};

const roleCopy: Record<RoleKey, RoleContent> = {
  guarda: {
    eyebrow: "SEGURIDAD OPERATIVA",
    title: "Entrada de control para porteria",
    subtitle: "Accede a escaneo, validacion y seguimiento del turno desde una interfaz mas seria y precisa.",
    featureA: "Escaneo directo",
    featureB: "Turno contextual",
    accentBg: "rgba(15,23,42,0.92)",
    accentBorder: "rgba(15,23,42,0.16)",
    accentIcon: "shield-checkmark-outline",
  },
  aprendiz: {
    eyebrow: "ACCESO PERSONAL",
    title: "Tu identidad digital en SADI",
    subtitle: "Consulta estado, QR y equipos desde una entrada clara, moderna y mucho mejor resuelta visualmente.",
    featureA: "QR dinamico",
    featureB: "Perfil y equipos",
    accentBg: "rgba(15,118,110,0.1)",
    accentBorder: "rgba(15,118,110,0.16)",
    accentIcon: "sparkles-outline",
  },
};

const trustItems = [
  { label: "RBAC", detail: "Permisos desde backend" },
  { label: "OTP", detail: "Recuperacion verificada" },
  { label: "QR", detail: "Acceso firmado y dinamico" },
];

function RoleSwitch({ active }: { active: RoleKey }) {
  const options: { key: RoleKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "guarda", label: "Guarda", icon: "shield-outline" },
    { key: "aprendiz", label: "Aprendiz", icon: "person-outline" },
  ];

  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {options.map((option) => {
        const isActive = option.key === active;
        return (
          <Pressable
            key={option.key}
            onPress={() => router.replace({ pathname: "/auth/login", params: { rol: option.key } } as any)}
            style={({ pressed }) => ({
              flex: 1,
              borderRadius: 20,
              paddingVertical: 13,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: isActive ? "rgba(15,118,110,0.18)" : "rgba(148,163,184,0.2)",
              backgroundColor: isActive ? "rgba(15,118,110,0.12)" : "rgba(255,255,255,0.72)",
              opacity: pressed ? 0.94 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Ionicons name={option.icon} size={18} color={isActive ? uiTheme.accentDeep : uiTheme.muted} />
              <Text style={{ color: isActive ? uiTheme.accentDeep : uiTheme.inkSoft, fontWeight: "900" }}>{option.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
export default function LoginScreen() {
  const params = useLocalSearchParams<{ rol?: RoleKey }>();
  const rol = (params.rol ?? "guarda") as RoleKey;
  const roleMeta = roleCopy[rol];

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
  }, [sede]);

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
      setError("La contrasena debe tener maximo 20 caracteres.");
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
      <FadeInCard delay={0} style={{ gap: 16 }}>
        <Pill text={roleMeta.eyebrow} />
        <RoleSwitch active={rol} />

        <View
          style={{
            borderRadius: 30,
            backgroundColor: roleMeta.accentBg,
            borderWidth: 1,
            borderColor: roleMeta.accentBorder,
            padding: 18,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={{ color: rol === "guarda" ? "rgba(255,255,255,0.66)" : uiTheme.accentDeep, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
                SADI Movil
              </Text>
              <Text style={{ color: rol === "guarda" ? "#ffffff" : uiTheme.ink, fontSize: 28, lineHeight: 32, fontWeight: "900", letterSpacing: -0.8 }}>
                {roleMeta.title}
              </Text>
              <Text style={{ color: rol === "guarda" ? "rgba(255,255,255,0.76)" : uiTheme.inkSoft, lineHeight: 20 }}>
                {roleMeta.subtitle}
              </Text>
            </View>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: rol === "guarda" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.58)",
                borderWidth: 1,
                borderColor: rol === "guarda" ? "rgba(255,255,255,0.12)" : "rgba(15,118,110,0.12)",
              }}
            >
              <Ionicons name={roleMeta.accentIcon} size={24} color={rol === "guarda" ? "#ffffff" : uiTheme.accentDeep} />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, borderRadius: 18, padding: 12, backgroundColor: rol === "guarda" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.62)" }}>
              <Text style={{ color: rol === "guarda" ? "rgba(255,255,255,0.62)" : uiTheme.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
                Prioridad
              </Text>
              <Text style={{ color: rol === "guarda" ? "#ffffff" : uiTheme.ink, fontSize: 16, fontWeight: "900", marginTop: 6 }}>{roleMeta.featureA}</Text>
            </View>
            <View style={{ flex: 1, borderRadius: 18, padding: 12, backgroundColor: rol === "guarda" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.62)" }}>
              <Text style={{ color: rol === "guarda" ? "rgba(255,255,255,0.62)" : uiTheme.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
                Contexto
              </Text>
              <Text style={{ color: rol === "guarda" ? "#ffffff" : uiTheme.ink, fontSize: 16, fontWeight: "900", marginTop: 6 }}>{roleMeta.featureB}</Text>
            </View>
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={70} style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: uiTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>Credenciales</Text>
          <TitleBlock title="Inicia sesion" subtitle="Escribe tus datos y continua con una autenticacion segura y clara." />
        </View>

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
          label="Contrasena"
          value={password}
          onChangeText={onPasswordChange}
          placeholder="********"
          secureTextEntry={!show}
        />

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <ModernButton label={show ? "Ocultar" : "Mostrar"} icon={show ? "eye-off-outline" : "eye-outline"} tone="light" onPress={() => setShow((v) => !v)} />
          </View>
          <View style={{ flex: 1 }}>
            <ModernButton label="Recuperar clave" icon="mail-open-outline" tone="light" onPress={() => router.push({ pathname: "/auth/password-recovery" } as any)} />
          </View>
        </View>

        {rol === "guarda" ? (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: uiTheme.muted, letterSpacing: 1, textTransform: "uppercase" }}>Contexto operativo</Text>
            <View style={{ gap: 10, padding: 14, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: "rgba(148,163,184,0.22)" }}>
              <View style={{ gap: 6 }}>
                <Text style={{ fontWeight: "800", color: uiTheme.ink }}>Sede</Text>
                <View style={{ borderWidth: 1, borderColor: "rgba(148,163,184,0.3)", borderRadius: 18, overflow: "hidden", backgroundColor: "rgba(248,250,252,0.96)" }}>
                  <Picker selectedValue={sede} onValueChange={(v) => setSede(v)}>
                    {sedes.map((item) => (
                      <Picker.Item key={item.id} label={item.name} value={item.code} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ fontWeight: "800", color: uiTheme.ink }}>Turno</Text>
                <View style={{ borderWidth: 1, borderColor: "rgba(148,163,184,0.3)", borderRadius: 18, overflow: "hidden", backgroundColor: "rgba(248,250,252,0.96)" }}>
                  <Picker selectedValue={jornada} onValueChange={(v) => setJornada(v)}>
                    <Picker.Item label="Manana" value="MAÑANA" />
                    <Picker.Item label="Tarde" value="TARDE" />
                    <Picker.Item label="Noche" value="NOCHE" />
                  </Picker>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {bloqueado ? (
          <View style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(185,28,28,0.08)", borderWidth: 1, borderColor: "rgba(185,28,28,0.16)" }}>
            <Text style={{ color: uiTheme.danger, fontWeight: "900" }}>
              Bloqueado temporalmente. Intenta en {lockRemainingSec}s.
            </Text>
          </View>
        ) : null}

        {error ? <Text style={{ color: uiTheme.danger, lineHeight: 20 }}>{error}</Text> : null}
        {rol === "guarda" && sedeLoadHint ? <Text style={{ color: uiTheme.danger, lineHeight: 20 }}>{sedeLoadHint}</Text> : null}

        <ModernButton
          label={loading ? "Ingresando..." : "Continuar"} icon="arrow-forward-outline"
          disabled={loading || biometricLoading || bloqueado || (rol === "guarda" && (!sede || sedes.length === 0))}
          onPress={onSubmit}
        />

        {showBiometricButton ? (
          <ModernButton
            label={biometricLoading ? "Validando huella..." : "Entrar con huella"} icon="finger-print-outline"
            tone="light"
            disabled={loading || biometricLoading || bloqueado || !biometricReady || (rol === "guarda" && (!sede || sedes.length === 0))}
            onPress={onBiometricSubmit}
          />
        ) : null}

        {biometricHint ? <Text style={{ color: uiTheme.muted, lineHeight: 20 }}>{biometricHint}</Text> : null}
        {loading || biometricLoading ? <ActivityIndicator style={{ marginTop: 4 }} color={uiTheme.accent} /> : null}
      </FadeInCard>

      <FadeInCard delay={120} style={{ gap: 12 }}>
        <Text style={{ color: uiTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>Senales de confianza</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {trustItems.map((item) => (
            <View
              key={item.label}
              style={{
                flex: 1,
                borderRadius: 20,
                padding: 12,
                backgroundColor: "rgba(255,255,255,0.72)",
                borderWidth: 1,
                borderColor: "rgba(148,163,184,0.22)",
              }}
            >
              <Text style={{ color: uiTheme.ink, fontSize: 18, fontWeight: "900" }}>{item.label}</Text>
              <Text style={{ color: uiTheme.inkSoft, marginTop: 6, fontSize: 12, lineHeight: 17 }}>{item.detail}</Text>
            </View>
          ))}
        </View>
        <ModernButton label="Volver" icon="arrow-back-outline" tone="dark" onPress={() => router.back()} />
      </FadeInCard>
    </ModernScreen>
  );
}
