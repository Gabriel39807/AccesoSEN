/**
 * Login movil para roles aprendiz/guarda (V5 Premium No-Scroll).
 *
 * Responsabilidad:
 * - Validar credenciales y sede/turno para guardas.
 * - Exponer acceso con biometría cuando existe sesión persistida.
 * - Diseño UI de alta gama: layout ajustado sin scroll, doble picker horizontal,
 *   header flotante arriba, botón compacto para huella.
 */
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View, Pressable, StyleSheet, Animated, Dimensions, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useSessionStore } from "../../src/store/session";
import { toUiErrorMessage } from "../../src/api/client";
import type { Jornada, Sede } from "../../src/api/turnos";
import { listSedes, type SedeItem } from "../../src/api/sedes";
import { sanitizeDigits, validateDocument6to10 } from "../../src/lib/validators";
import { isBiometricAvailable } from "../../src/auth/biometric";
import { hasRefreshToken, isBiometricEnabled } from "../../src/storage/tokens";
import { usePreferencesStore, useResolvedThemeMode } from "../../src/store/preferences";
import { InputField, ModernButton, Pill, SwirlingConstellations } from "../../src/ui/modern";

const SCREEN_HEIGHT = Dimensions.get("window").height;

// We now use the global SwirlingConstellations and PATTERN_ICONS from modern.tsx

export default function LoginScreen() {
  const params = useLocalSearchParams<{ rol?: "guarda" | "aprendiz" }>();
  // Forced to 'guarda' as per prompt if not specified, though it handles both.
  const rol = (params.rol ?? "guarda") as "guarda" | "aprendiz";

  const signIn = useSessionStore((s) => s.signIn);
  const signInWithBiometric = useSessionStore((s) => s.signInWithBiometric);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  const [sede, setSede] = useState<Sede>("");
  const [sedes, setSedes] = useState<SedeItem[]>([]);
  const [jornada, setJornada] = useState<Jornada>("MAÑANA" as Jornada);

  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBiometricButton, setShowBiometricButton] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricHint, setBiometricHint] = useState<string | null>(null);
  const [sedeLoadHint, setSedeLoadHint] = useState<string | null>(null);

  const [lockRemainingSec, setLockRemainingSec] = useState(0);
  const themeMode = useResolvedThemeMode();
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
  const isDark = themeMode === "dark";

  // Entrance animation
  const introAnimFade = useRef(new Animated.Value(0)).current;
  const introAnimSlide = useRef(new Animated.Value(30)).current;
  const cardAnimFade = useRef(new Animated.Value(0)).current;
  const cardAnimSlide = useRef(new Animated.Value(30)).current;
  const actionAnimFade = useRef(new Animated.Value(0)).current;
  const actionAnimSlide = useRef(new Animated.Value(30)).current;

  function onUsernameChange(value: string) {
    setUsername(sanitizeDigits(value).slice(0, 10));
  }

  function onPasswordChange(value: string) {
    setPassword(value.slice(0, 20));
  }

  function onBackPress() {
    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/" as any);
  }

  const bloqueado = lockRemainingSec > 0;

  useEffect(() => {
    // 1. Enter Header/Brand
    Animated.parallel([
      Animated.timing(introAnimFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(introAnimSlide, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true })
    ]).start();

    // 2. Enter Form Card
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(cardAnimFade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(cardAnimSlide, { toValue: 0, tension: 40, friction: 8, useNativeDriver: true })
      ]).start();
    }, 150);

    // 3. Enter Actions
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(actionAnimFade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(actionAnimSlide, { toValue: 0, tension: 40, friction: 8, useNativeDriver: true })
      ]).start();
    }, 300);
  }, [actionAnimFade, actionAnimSlide, cardAnimFade, cardAnimSlide, introAnimFade, introAnimSlide]);

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
        if (items.length > 0) {
          setSede((current) => current || items[0].code);
          setSedeLoadHint(null);
        }
        if (items.length === 0) setSedeLoadHint("No hay sedes activas disponibles.");
      } catch {
        if (!mounted) return;
        setSedes([]);
        setSedeLoadHint("No se pudieron cargar las sedes. Puedes continuar y se usara tu sede principal.");
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [available, hasRefresh, enabled] = await Promise.all([
          isBiometricAvailable(), hasRefreshToken(), isBiometricEnabled(),
        ]);
        if (!mounted) return;
        setShowBiometricButton(Boolean(available));
        setBiometricReady(Boolean(available && hasRefresh && enabled));
        if (!available) setBiometricHint("Huella no disponible en el dispositivo.");
        else if (!hasRefresh) setBiometricHint("Aún no tienes sesión guardada para huella.");
        else if (!enabled) setBiometricHint("Huella desactivada localmente.");
        else setBiometricHint(null);
      } catch {
        if (!mounted) return;
        setShowBiometricButton(false);
        setBiometricReady(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function onSubmit() {
    setError(null);
    if (bloqueado) return;
    const documentError = validateDocument6to10(username.trim());
    if (documentError) { setError(documentError); return; }
    if (!password || password.length > 20) { setError("Contraseña inválida (máx 20 chars)."); return; }
    if (rol === "guarda" && !sede && sedes.length > 0) { setError("Selecciona una sede."); return; }
    if (rol === "guarda" && !jornada) { setError("Selecciona un turno."); return; }

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
      setError(toUiErrorMessage(e, "Error de credenciales."));
      const code = e?.code as string | undefined;
      const secondsRemaining = Number(e?.detail?.seconds_remaining || 0);
      if (code === "ACCOUNT_LOCKED_15MIN") setLockRemainingSec(secondsRemaining > 0 ? secondsRemaining : 15 * 60);
    } finally {
      setLoading(false);
    }
  }

  async function onBiometricSubmit() {
    setError(null);
    if (bloqueado) return;
    if (rol === "guarda" && !sede && sedes.length > 0) { setError("Selecciona sede primero."); return; }
    if (rol === "guarda" && !jornada) { setError("Selecciona un turno."); return; }

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
      setError(toUiErrorMessage(e, "Huella rechazada."));
    } finally {
      setBiometricLoading(false);
    }
  }

  const mappedTheme = rol === "guarda" ? "guard" : "aprendiz";
  const palette = {
    background: isDark ? ["#091220", "#0d1b32", "#123252"] : ["#fbfdff", "#f3f8ff", "#e7f0ff"],
    header: rol === "guarda"
      ? (isDark ? ["#163a80", "#0c1730"] : ["#3b82f6", "#1d4fd8"])
      : (isDark ? ["#0f5d8f", "#0a2138"] : ["#23b6f6", "#0b89d1"]),
    surface: isDark ? "rgba(12, 22, 36, 0.84)" : "rgba(255,255,255,0.88)",
    surfaceBorder: isDark ? "rgba(93, 161, 248, 0.18)" : "rgba(135, 171, 236, 0.18)",
    title: isDark ? "#f8fbff" : "#0f172a",
    subtitle: isDark ? "#97accf" : "#64748b",
    hint: isDark ? "#9bb0d2" : "#64748b",
    accent: rol === "guarda" ? (isDark ? "#8dc8ff" : "#1e4fd8") : (isDark ? "#9be8ff" : "#0b89d1"),
    bioBg: isDark ? "rgba(18, 46, 79, 0.96)" : rol === "aprendiz" ? "#e0f7ff" : "#ddebff",
  };
  const aprendizInputStyle =
    rol === "aprendiz"
      ? {
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: isDark ? "rgba(14,26,38,0.88)" : "#f8fafc",
          borderColor: isDark ? "rgba(82, 195, 255, 0.22)" : "rgba(102, 194, 255, 0.18)",
        }
      : undefined;

  return (
    // Strictly NO-SCROLL View with native keyboard handling
    // FIX: Android 'adjustResize' already shrinks the window natively. Using behavior="height" causes a double-shrink that drops focus.
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: isDark ? "#091220" : "#fbfdff" }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Background with uniform pattern texture - Premium Depth Pale Blue */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient 
          colors={palette.background as any} 
          style={StyleSheet.absoluteFill} 
        />
        <SwirlingConstellations />
      </View>

      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, minHeight: SCREEN_HEIGHT }}
        keyboardShouldPersistTaps="always"
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          
          {/* TOP INTRO SECTION ANIMATED */}
        <Animated.View style={{ opacity: introAnimFade, transform: [{ translateY: introAnimSlide }] }}>
          {/* Top Header Row Area (Sapphire-to-Cobalt Gradient Band) */}
        <LinearGradient 
          colors={palette.header as any} 
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 1 }} 
          style={styles.topHeaderBand}
        >
          <Pressable onPress={onBackPress} style={styles.headerIconBtn}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </Pressable>
          <View style={styles.headerRightActions}>
            <Pressable onPress={() => setThemeMode(isDark ? "light" : "dark")} style={styles.headerIconBtn}>
              <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={22} color="#ffffff" />
            </Pressable>
            <Pressable onPress={() => router.push("/auth/support" as any)} style={styles.headerIconBtn}>
              <Ionicons name="help-circle-outline" size={26} color="#ffffff" />
            </Pressable>
          </View>
        </LinearGradient>

        {/* Branding & Welcome */}
        <View style={styles.brandSection}>
          <Pill text={rol === "guarda" ? "SEGURIDAD" : "ESTUDIANTE"} icon={rol === "guarda" ? "shield-checkmark" : "school"} tone={mappedTheme} />
          <Text style={[styles.titleText, { color: palette.title }]}>Iniciar sesión</Text>
          <Text style={[styles.subtitleText, { color: palette.subtitle }]}>{rol === "guarda" ? "Tu labor garantiza la seguridad de nuestra institución." : "Consulta tu estado y mi QR."}</Text>
        </View>
      </Animated.View>

        {/* Login Form Card (Glassmorphism, tightly packed) - SEQUENTIAL ANIM */}
        <Animated.View style={[
          styles.formCard,
          {
            backgroundColor: palette.surface,
            borderColor: palette.surfaceBorder,
            shadowColor: isDark ? "#000000" : "rgba(125, 160, 225, 0.20)",
          },
          rol === "aprendiz" && { 
            paddingVertical: 24, 
            gap: 16, 
            shadowColor: "#0f172a",
            shadowOpacity: 0.08,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8
          }, 
          { opacity: cardAnimFade, transform: [{ translateY: cardAnimSlide }] }
        ]} pointerEvents="box-none">
          <InputField
            icon="person-outline"
            label="Documento"
            value={username}
            onChangeText={onUsernameChange}
            autoCapitalize="none"
            placeholder="Ej. 1053444048"
            keyboardType="number-pad"
            maxLength={10}
            selectionColor={palette.accent}
            iconColor={rol === "guarda" ? "#1e3a8a" : "#0ea5e9"}
            wrapperStyle={aprendizInputStyle}
          />

          <View>
            <InputField
              icon="lock-closed-outline"
              label="Contraseña"
              value={password}
              onChangeText={onPasswordChange}
              placeholder="••••••••"
              secureTextEntry={!show}
              rightIcon={show ? "eye-off-outline" : "eye-outline"}
              onRightIconPress={() => setShow((v) => !v)}
              selectionColor={palette.accent}
              iconColor={rol === "guarda" ? "#1e3a8a" : "#0ea5e9"}
              rightIconColor={rol === "guarda" ? "#1e3a8a" : "#0ea5e9"}
              wrapperStyle={aprendizInputStyle}
            />
            <Pressable onPress={() => router.push("/auth/password-recovery" as any)} style={{ alignSelf: "center", marginTop: 12 }}>
              <Text style={{ color: palette.accent, fontSize: 13, fontWeight: "700" }}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
          </View>

          {/* Side-by-Side Pickers to save vertical space */}
          {rol === "guarda" && (
            <View style={styles.rowSelectors}>
              <View style={styles.dropdownCol}>
                <Text style={styles.dropdownLabel}>Sede</Text>
                <View style={[styles.pickerContainer, { backgroundColor: isDark ? "rgba(15,24,40,0.86)" : "#f8fbff", borderColor: palette.surfaceBorder }]}>
                  <Picker
                    selectedValue={sede}
                    onValueChange={(value) => setSede(String(value) as Sede)}
                    style={[styles.pickerNative, { color: isDark ? "#f8fbff" : "#0f172a" }]}
                    itemStyle={[styles.pickerItem, { color: isDark ? "#f8fbff" : "#0f172a" }]}
                    dropdownIconColor={rol === "guarda" ? "#1e3a8a" : "#0ea5e9"}
                  >
                    <Picker.Item label="Selecciona una sede" value="" />
                    {sedes.map((item) => (
                      <Picker.Item key={item.id} label={item.name} value={item.code} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.dropdownCol}>
                <Text style={styles.dropdownLabel}>Turno</Text>
                <View style={[styles.pickerContainer, { backgroundColor: isDark ? "rgba(15,24,40,0.86)" : "#f8fbff", borderColor: palette.surfaceBorder }]}>
                  <Picker
                    selectedValue={jornada}
                    onValueChange={(value) => setJornada(String(value) as Jornada)}
                    style={[styles.pickerNative, { color: isDark ? "#f8fbff" : "#0f172a" }]}
                    itemStyle={[styles.pickerItem, { color: isDark ? "#f8fbff" : "#0f172a" }]}
                    dropdownIconColor={rol === "guarda" ? "#1e3a8a" : "#0ea5e9"}
                  >
                    <Picker.Item label="Selecciona un turno" value="" />
                    <Picker.Item label="MAÑANA" value="MAÑANA" />
                    <Picker.Item label="TARDE" value="TARDE" />
                    <Picker.Item label="NOCHE" value="NOCHE" />
                  </Picker>
                </View>
              </View>
            </View>
          )}

          {/* Feedback Area has been successfully moved below the Action Buttons */}
        </Animated.View>

        {/* ACTIONS & FOOTER AREA - SEQUENTIAL ANIM */}
        <Animated.View style={[{ opacity: actionAnimFade, transform: [{ translateY: actionAnimSlide }] }, styles.actionsContainerLayout]} pointerEvents="box-none">
          <View style={styles.actionsArea}>
            <ModernButton
              icon="arrow-forward-outline"
              label={loading ? "Verificando..." : "Continuar"}
              tone="guard" // Force deep sapphire for all roles
              disabled={loading || biometricLoading || bloqueado || (rol === "guarda" && ((sedes.length > 0 && !sede) || !jornada))}
              onPress={onSubmit}
            />

            {/* Ultra Compact Light Blue Biometric Action */}
            {showBiometricButton && (
              <View style={styles.compactBioWrapper}>
                <Pressable
                  disabled={loading || biometricLoading || bloqueado || !biometricReady || (rol === "guarda" && ((sedes.length > 0 && !sede) || !jornada))}
                  onPress={onBiometricSubmit}
                  style={({ pressed }) => [
                    styles.compactBioBtn,
                    { backgroundColor: palette.bioBg },
                    pressed && { opacity: 0.7 },
                    (!biometricReady) && { opacity: 0.4 }
                  ]}
                >
                  <Ionicons name="finger-print" size={24} color={rol === "aprendiz" ? "#0ea5e9" : "#1e3a8a"} />
                  <Text style={[styles.compactBioText, { color: "#ffffff" }]}>Entrar con huella</Text>
                </Pressable>
                {biometricHint && <Text style={[styles.compactBioHint, { color: palette.hint }]}>{biometricHint}</Text>}
              </View>
            )}
          </View>

          {/* Feedback Area Moved Below Buttons */}
          <View style={[styles.feedbackArea, { marginTop: 16 }]}>
            {bloqueado && <Text style={[styles.errorText, { color: palette.accent }]}>Bloqueado temporalmente. Intenta en {lockRemainingSec}s.</Text>}
            {error && <Text style={[styles.errorText, { color: palette.accent }]}>{error}</Text>}
            {rol === "guarda" && sedeLoadHint && <Text style={[styles.errorText, { color: palette.accent }]}>{sedeLoadHint}</Text>}
            {(loading || biometricLoading) && <ActivityIndicator color={rol === "guarda" ? "#1e3a8a" : "#0ea5e9"} />}
          </View>

          <View style={styles.footerRow}>
            <Ionicons name="lock-closed" size={12} color={palette.hint} />
            <Text style={[styles.footerText, { color: palette.hint }]}>© 2026 Asegurado por S.A.D.I</Text>
          </View>

        </Animated.View>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  bgOrb: {
    position: "absolute",
    width: SCREEN_HEIGHT * 0.5,
    height: SCREEN_HEIGHT * 0.5,
    borderRadius: 999,
  },
  contentWrapper: {
    flexGrow: 1, // Let it grow if needed, but don't force squash via flex: 1
    paddingHorizontal: 24,
    paddingTop: 12, // Compact top margin
    paddingBottom: 12, // Compact bottom margin
    justifyContent: "space-between", // Spread content naturally
  },
  topHeaderBand: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
    borderRadius: 20, // Rounded pill-like header
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: "#1e3a8a",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  headerIconBtn: {
    padding: 8,
    borderRadius: 999,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  brandSection: {
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  titleText: {
    fontSize: 34,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -1,
    marginTop: 8,
  },
  subtitleText: {
    fontSize: 15,
    color: "#64748b",
    fontWeight: "500",
  },
  formCard: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 32,
    padding: 20,
    gap: 12,
    // Soft drop shadow instead of harsh border
    shadowColor: "#94a3b8",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.5)",
  },
  rowSelectors: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dropdownCol: {
    width: "48%", // Precise sizing for side-by-side
    gap: 6,
  },
  dropdownLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginLeft: 4,
  },
  pickerContainer: {
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
    overflow: "hidden",
    height: 50,
    justifyContent: "center",
  },
  pickerNative: {
    width: "100%",
    color: "#0f172a",
  },
  pickerItem: {
    fontSize: 14,
  },
  feedbackArea: {
    minHeight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#1e3a8a", // Sapphire blue error mapping
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  actionsContainerLayout: {
    gap: 8,
    marginTop: -8, // move the entire fingerprint state area up slightly to reduce the center void
  },
  actionsArea: {
    gap: 12,
    marginTop: 0,
  },
  compactBioWrapper: {
    alignItems: "center",
    gap: 4,
  },
  compactBioBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#bae6fd", // Deep sapphire complementary Light sky-blue
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    gap: 8,
    shadowColor: "#0ea5e9",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  compactBioText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff", // Pure white text as requested for Chimbita
  },
  compactBioHint: {
    fontSize: 11,
    color: "#64748b",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6
  },
  footerText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5
  }
});
