import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSessionStore } from "../../src/store/session";
import { toUiErrorMessage } from "../../src/api/client";
import type { Jornada, Sede } from "../../src/api/turnos";
import { listSedes, type SedeItem } from "../../src/api/sedes";
import { sanitizeDigits, validateDocument6to10 } from "../../src/lib/validators";
import { hasRefreshToken, isBiometricEnabled } from "../../src/storage/tokens";
import { isBiometricAvailable } from "../../src/auth/biometric";
import { FadeInCard, InputField, ModernButton, ModernScreen, NoticeBanner, Pill } from "../../src/ui/modern";
import { useSystemBranding } from "../../src/theme/system-branding";

export default function LoginScreen() {
  const params = useLocalSearchParams<{ rol?: "guarda" | "aprendiz" }>();
  const rol = (params.rol ?? "guarda") as "guarda" | "aprendiz";
  const theme = rol === "guarda" ? "guard" : "aprendiz";

  const signIn = useSessionStore((s) => s.signIn);
  const signInWithBiometric = useSessionStore((s) => s.signInWithBiometric);
  const { config } = useSystemBranding();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sede, setSede] = useState<Sede>("");
  const [sedes, setSedes] = useState<SedeItem[]>([]);
  const [jornada, setJornada] = useState<Jornada>("MANANA");
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBiometricButton, setShowBiometricButton] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricHint, setBiometricHint] = useState<string | null>(null);
  const [sedeLoadHint, setSedeLoadHint] = useState<string | null>(null);
  const [lockRemainingSec, setLockRemainingSec] = useState(0);

  useEffect(() => {
    if (lockRemainingSec <= 0) return;
    const timer = setInterval(() => {
      setLockRemainingSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
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
          setSedeLoadHint("No hay sedes activas disponibles.");
        }
      } catch {
        if (!mounted) return;
        setSedes([]);
        setSedeLoadHint("No se pudieron cargar las sedes.");
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
        if (!available) setBiometricHint("La biometria no esta disponible en este dispositivo.");
        else if (!hasRefresh) setBiometricHint("Inicia sesion una vez para habilitar biometria.");
        else if (!enabled) setBiometricHint("La biometria local esta desactivada.");
        else setBiometricHint(null);
      } catch {
        if (!mounted) return;
        setShowBiometricButton(false);
        setBiometricReady(false);
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
    setPassword(value.slice(0, 40));
  }

  const blocked = lockRemainingSec > 0;

  async function onSubmit() {
    setError(null);
    if (blocked) return;
    const documentError = validateDocument6to10(username.trim());
    if (documentError) {
      setError(documentError);
      return;
    }
    if (!password) {
      setError("Ingresa tu contrasena.");
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
      if (rol === "aprendiz" && mustChange) router.replace("/auth/first-password" as any);
      else router.replace(rol === "guarda" ? ("/guard/home" as any) : ("/aprendiz/home" as any));
    } catch (e: any) {
      setError(toUiErrorMessage(e, "No fue posible iniciar sesion."));
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
    if (blocked) return;
    if (rol === "guarda" && !sede) {
      setError("Selecciona una sede primero.");
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
      if (rol === "aprendiz" && mustChange) router.replace("/auth/first-password" as any);
      else router.replace(rol === "guarda" ? ("/guard/home" as any) : ("/aprendiz/home" as any));
    } catch (e: any) {
      setError(toUiErrorMessage(e, "La biometria fue rechazada."));
    } finally {
      setBiometricLoading(false);
    }
  }

  const institution = config.nombre_institucion || "SADI";

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ModernScreen scroll theme={theme} contentStyle={styles.screenContent}>
        <FadeInCard delay={0} intensity={85} style={styles.heroCard}>
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={18} color="#F3F7FB" />
            </Pressable>
            <Pill
              text={rol === "guarda" ? "Acceso operativo" : "Acceso personal"}
              icon={rol === "guarda" ? "shield-checkmark-outline" : "person-circle-outline"}
              tone={theme}
            />
          </View>

          <View style={styles.heroTextBlock}>
            <Text style={styles.kicker}>Command Noir</Text>
            <Text style={styles.heroTitle}>{institution}</Text>
            <Text style={styles.heroSubtitle}>
              {rol === "guarda"
                ? "Ingresa a una consola de control segura, precisa y lista para operar en campo."
                : "Accede a tu experiencia institucional con una interfaz clara, segura y premium."}
            </Text>
          </View>

          <View style={styles.heroMetaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="scan-outline" size={15} color="#B8C3D1" />
              <Text style={styles.metaText}>Operacion inmediata</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="lock-closed-outline" size={15} color="#B8C3D1" />
              <Text style={styles.metaText}>Sesion protegida</Text>
            </View>
          </View>
        </FadeInCard>

        <FadeInCard delay={80} intensity={70} style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Iniciar sesion</Text>
            <Text style={styles.formSubtitle}>
              {rol === "guarda" ? "Documento, contrasena y contexto operativo." : "Documento y contrasena."}
            </Text>
          </View>

          <InputField
            label="Documento"
            icon="card-outline"
            value={username}
            onChangeText={onUsernameChange}
            keyboardType="number-pad"
            autoCapitalize="none"
            maxLength={10}
            placeholder="Ej. 1053444048"
          />

          <InputField
            label="Contrasena"
            icon="lock-closed-outline"
            value={password}
            onChangeText={onPasswordChange}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            rightIcon={showPassword ? "eye-off-outline" : "eye-outline"}
            onRightIconPress={() => setShowPassword((value) => !value)}
          />

          {rol === "guarda" ? (
            <View style={styles.selectorRow}>
              <View style={styles.selectorColumn}>
                <Text style={styles.selectorLabel}>Sede</Text>
                <View style={styles.selectorFrame}>
                  <Picker selectedValue={sede} onValueChange={setSede} style={styles.picker} dropdownIconColor="#B8C3D1">
                    {sedes.map((item) => (
                      <Picker.Item key={item.id} label={item.name} value={item.code} />
                    ))}
                  </Picker>
                </View>
              </View>
              <View style={styles.selectorColumn}>
                <Text style={styles.selectorLabel}>Jornada</Text>
                <View style={styles.selectorFrame}>
                  <Picker selectedValue={jornada} onValueChange={setJornada} style={styles.picker} dropdownIconColor="#B8C3D1">
                    <Picker.Item label="Manana" value="MANANA" />
                    <Picker.Item label="Tarde" value="TARDE" />
                    <Picker.Item label="Noche" value="NOCHE" />
                  </Picker>
                </View>
              </View>
            </View>
          ) : null}

          <Pressable onPress={() => router.push("/auth/password-recovery" as any)} style={styles.recoveryLink}>
            <Text style={styles.recoveryText}>Olvide mi contrasena</Text>
          </Pressable>

          {blocked ? <NoticeBanner tone="danger" text={`Bloqueo temporal activo. Intenta de nuevo en ${lockRemainingSec}s.`} /> : null}
          {error ? <NoticeBanner tone="danger" text={error} /> : null}
          {rol === "guarda" && sedeLoadHint ? <NoticeBanner tone="info" text={sedeLoadHint} /> : null}

          <View style={styles.actionsBlock}>
            <ModernButton
              icon="arrow-forward-outline"
              label={loading ? "Verificando..." : "Continuar"}
              tone="guard"
              disabled={loading || biometricLoading || blocked || (rol === "guarda" && (!sede || sedes.length === 0))}
              onPress={onSubmit}
            />

            {showBiometricButton ? (
              <>
                <ModernButton
                  icon="finger-print-outline"
                  label={biometricLoading ? "Validando..." : "Entrar con biometria"}
                  tone="light"
                  disabled={loading || biometricLoading || blocked || !biometricReady || (rol === "guarda" && (!sede || sedes.length === 0))}
                  onPress={onBiometricSubmit}
                />
                {biometricHint ? <Text style={styles.bioHint}>{biometricHint}</Text> : null}
              </>
            ) : null}
          </View>

          {loading || biometricLoading ? <ActivityIndicator color="#6FD3FF" style={{ marginTop: 4 }} /> : null}
        </FadeInCard>
      </ModernScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screenContent: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 16,
    paddingBottom: 28,
  },
  heroCard: {
    gap: 16,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextBlock: {
    gap: 8,
  },
  kicker: {
    fontSize: 11,
    color: "#7F90A3",
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    color: "#F3F7FB",
    letterSpacing: -0.9,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#B8C3D1",
  },
  heroMetaRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: "#B8C3D1",
    fontWeight: "600",
  },
  formCard: {
    gap: 14,
  },
  formHeader: {
    gap: 6,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#F3F7FB",
    letterSpacing: -0.6,
  },
  formSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: "#B8C3D1",
  },
  selectorRow: {
    flexDirection: "row",
    gap: 12,
  },
  selectorColumn: {
    flex: 1,
    gap: 8,
  },
  selectorLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "#7F90A3",
    fontWeight: "700",
  },
  selectorFrame: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(24,34,49,0.96)",
    justifyContent: "center",
    overflow: "hidden",
  },
  picker: {
    color: "#F3F7FB",
  },
  recoveryLink: {
    alignSelf: "flex-start",
  },
  recoveryText: {
    fontSize: 13,
    color: "#6FD3FF",
    fontWeight: "700",
  },
  actionsBlock: {
    gap: 10,
    marginTop: 4,
  },
  bioHint: {
    fontSize: 12,
    lineHeight: 17,
    color: "#7F90A3",
    textAlign: "center",
  },
});
