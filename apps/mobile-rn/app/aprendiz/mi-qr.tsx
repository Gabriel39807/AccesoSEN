import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, toUiErrorMessage } from "../../src/api/client";
import AprendizBottomDock from "../../src/components/aprendiz/AprendizBottomDock";
import { useResolvedThemeMode } from "../../src/store/preferences";

type QrResponse = {
  permitido: boolean;
  motivo: string | null;
  documento?: string;
  qr_value?: string;
  qr_png_base64?: string;
  algoritmo?: string;
};

type Mode = "light" | "dark";

const themes = {
  light: {
    background: ["#fbfdff", "#f3f8ff", "#e8f1ff"] as [string, string, string],
    ambientTop: ["rgba(109,190,245,0.13)", "rgba(109,190,245,0.03)", "transparent"] as [string, string, string],
    ambientBeam: ["transparent", "rgba(196,230,255,0.16)", "rgba(255,255,255,0.05)"] as [string, string, string],
    ambientBottom: ["rgba(255,255,255,0.03)", "rgba(221,238,255,0.20)", "rgba(243,249,255,0.22)"] as [string, string, string],
    meshBorder: "rgba(173, 210, 237, 0.20)",
    cardBg: "rgba(255,255,255,0.80)",
    cardBorder: "rgba(96, 173, 229, 0.18)",
    text: "#132844",
    textMuted: "#4f6d8e",
    textSoft: "#7b93ad",
    accent: "#0b89d1",
    accentStrong: "#0875b3",
    accentSoft: "rgba(14,165,233,0.10)",
    qrSurface: "rgba(255,255,255,0.92)",
    qrBorder: "rgba(96, 173, 229, 0.20)",
    helper: "#5f7f9f",
  },
  dark: {
    background: ["#07111c", "#0a1b2c", "#0f3044"] as [string, string, string],
    ambientTop: ["rgba(82,195,255,0.13)", "rgba(82,195,255,0.03)", "transparent"] as [string, string, string],
    ambientBeam: ["transparent", "rgba(25,144,209,0.10)", "transparent"] as [string, string, string],
    ambientBottom: ["transparent", "rgba(37,164,229,0.08)", "rgba(37,164,229,0.02)"] as [string, string, string],
    meshBorder: "rgba(96, 177, 230, 0.10)",
    cardBg: "rgba(12,24,38,0.74)",
    cardBorder: "rgba(71, 181, 245, 0.18)",
    text: "#f6fbff",
    textMuted: "#d0eaf8",
    textSoft: "#8fb0c4",
    accent: "#4fc9ff",
    accentStrong: "#1eb2ee",
    accentSoft: "rgba(79,201,255,0.12)",
    qrSurface: "rgba(255,255,255,0.98)",
    qrBorder: "rgba(109, 214, 255, 0.22)",
    helper: "#9cb9cd",
  },
};

export default function MiQrScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QrResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const mode = useResolvedThemeMode() as Mode;
  const theme = themes[mode];
  const isDark = mode === "dark";

  async function cargar() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.get<QrResponse>("/api/aprendiz/mi-qr/");
      setData(r.data);
    } catch (e: any) {
      setData(null);
      setMsg(toUiErrorMessage(e, "No se pudo cargar tu QR."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.background[0] }]}>
      <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={theme.ambientTop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ambientTop} />
      <LinearGradient colors={theme.ambientBeam} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ambientBeam} />
      <LinearGradient colors={theme.ambientBottom} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.ambientBottom} />
      <View style={[styles.content, { paddingTop: insets.top + 18, paddingBottom: 132 + Math.max(insets.bottom, 8) }]}>
        <View style={styles.topHeader}>
          <Text style={[styles.kicker, { color: theme.textSoft }]}>Credencial digital</Text>
          <Text style={[styles.title, { color: theme.text }]}>Mi QR institucional</Text>
          <Text style={[styles.subtitle, { color: theme.textSoft }]}>Muéstralo cuando necesites validar tu acceso.</Text>
        </View>

        <View
          style={[
            styles.qrShell,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
              shadowColor: isDark ? "rgba(0,0,0,0.30)" : "rgba(138, 187, 227, 0.18)",
            },
          ]}
        >
          <View style={styles.qrHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>QR activo</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSoft }]}>Listo para escanear</Text>
            </View>

            <Pressable onPress={() => void cargar()} style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}>
              <View style={[styles.refreshPill, { backgroundColor: theme.accentSoft, borderColor: theme.cardBorder }]}>
                <Ionicons name="refresh-outline" size={14} color={theme.accentStrong} />
                <Text style={[styles.refreshText, { color: theme.accentStrong }]}>{loading ? "Actualizando" : "Actualizar"}</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.qrBody}>
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={theme.accentStrong} />
                <Text style={[styles.loadingText, { color: theme.textSoft }]}>Generando tu codigo</Text>
              </View>
            ) : msg ? (
              <View style={styles.loadingWrap}>
                <Ionicons name="alert-circle-outline" size={22} color="#b91c1c" />
                <Text style={styles.errorText}>{msg}</Text>
              </View>
            ) : data?.qr_png_base64 ? (
              <View style={styles.qrWrap}>
                <View style={[styles.qrCard, { backgroundColor: theme.qrSurface, borderColor: theme.qrBorder, shadowColor: isDark ? "rgba(0,0,0,0.22)" : "rgba(150, 184, 228, 0.16)" }]}>
                  <LinearGradient
                    colors={mode === "dark" ? ["rgba(79,201,255,0.06)", "rgba(79,201,255,0.01)"] : ["rgba(255,255,255,0.82)", "rgba(14,165,233,0.02)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Image
                    source={{ uri: `data:image/png;base64,${data.qr_png_base64}` }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                </View>

                <View style={styles.metaBlock}>
                  <Text style={[styles.documentLabel, { color: theme.textSoft }]}>Documento</Text>
                  <Text style={[styles.documentValue, { color: theme.text }]}>{data.documento || "-"}</Text>
                </View>

                <Text style={[styles.helperText, { color: theme.helper }]}>Ten esta credencial lista para un acceso rapido.</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <AprendizBottomDock active="mi-qr" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  ambientTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  ambientBeam: {
    position: "absolute",
    top: 130,
    left: -34,
    right: -34,
    height: 260,
    transform: [{ rotate: "-7deg" }],
  },
  ambientBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 104,
    height: 230,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: "center",
    gap: 18,
  },
  topHeader: {
    alignItems: "center",
    gap: 5,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  qrShell: {
    borderRadius: 32,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  qrHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
  },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: "800",
  },
  qrBody: {
    minHeight: 420,
    justifyContent: "center",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 260,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "600",
  },
  qrWrap: {
    alignItems: "center",
    gap: 16,
  },
  qrCard: {
    width: 306,
    height: 306,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    overflow: "hidden",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  qrImage: {
    width: 250,
    height: 250,
    borderRadius: 18,
  },
  metaBlock: {
    alignItems: "center",
    gap: 4,
  },
  documentLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  documentValue: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 14,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "#b91c1c",
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
