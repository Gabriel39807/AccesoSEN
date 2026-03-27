/**
 * Scanner de guarda para QR/codigo de barras.
 *
 * Responsabilidad:
 * - Leer codigo de documento.
 * - Bloquear lecturas concurrentes mientras se procesa una validacion.
 * - Permitir reinicio manual seguro con "Leer otro QR".
 */
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Accesos from "../../src/api/accesos";
import { toUiErrorMessage } from "../../src/api/client";
import { normalizeScanValue, validateScanValue } from "../../src/lib/validators";
import { InputField, ModernButton } from "../../src/ui/modern";
import { useResolvedThemeMode } from "../../src/store/preferences";
import GuardBottomDock from "../../src/components/guard/GuardBottomDock";
import { guardHomeThemes, GuardThemeMode } from "../../src/components/guard/GuardHomeSections";

const BARCODE_TYPES: any[] = ["qr", "code128", "code39", "code93", "ean13", "ean8", "upc_a", "upc_e", "pdf417", "itf14"];

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const mode = useResolvedThemeMode() as GuardThemeMode;
  const theme = guardHomeThemes[mode];
  const isDark = mode === "dark";

  const [documento, setDocumento] = useState("");
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canScan = useMemo(() => !scanned && !loading && !isProcessing, [scanned, loading, isProcessing]);

  async function validar(doc: string) {
    const clean = doc.trim();
    const documentError = validateScanValue(clean);
    if (documentError) {
      setMsg(documentError);
      setIsProcessing(false);
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const data = await Accesos.validarDocumento(clean);
      Accesos.__cache.set(clean, data);
      router.push({ pathname: "/guard/confirmacion", params: { status: "ok", documento: clean } } as any);
    } catch (e: any) {
      setIsProcessing(false);
      const status = e?.response?.status;

      if (status === 404) {
        router.push({ pathname: "/guard/confirmacion", params: { status: "notfound", documento: clean } } as any);
      } else {
        const motivo = toUiErrorMessage(e, "Acceso denegado.");
        router.push({ pathname: "/guard/confirmacion", params: { status: "denied", documento: clean, motivo } } as any);
      }
    } finally {
      setLoading(false);
    }
  }

  function reiniciarLectura() {
    setScanned(false);
    setIsProcessing(false);
    setLoading(false);
    setMsg(null);
    setDocumento("");
    setCameraKey((v) => v + 1);
  }

  const onBarcodeDetected = async (raw: string) => {
    if (!canScan) return;
    const scannedValue = normalizeScanValue(raw);
    setScanned(true);
    setIsProcessing(true);
    setDocumento(scannedValue);
    setMsg("Codigo detectado. Validando acceso...");
    await validar(scannedValue);
  };

  if (!permission) {
    return (
      <View style={[styles.centerState, { backgroundColor: theme.background[0] }]}>
        <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color={theme.accentStrong} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background[0] }]}>
        <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.permissionWrap, { paddingTop: insets.top + 24, paddingBottom: 142 + Math.max(insets.bottom, 10) }]}>
          <View
            style={[
              styles.permissionCard,
              {
                backgroundColor: theme.sectionBg,
                borderColor: theme.cardBorder,
                shadowColor: isDark ? theme.accentGlow : "rgba(120, 158, 224, 0.20)",
              },
            ]}
          >
            <View style={[styles.permissionIcon, { backgroundColor: isDark ? "rgba(89,185,255,0.12)" : "rgba(45,104,216,0.08)" }]}>
              <Ionicons name="camera-outline" size={28} color={theme.accent} />
            </View>
            <Text style={[styles.permissionTitle, { color: theme.text }]}>Permite el acceso a la camara</Text>
            <Text style={[styles.permissionText, { color: theme.textSoft }]}>
              S.A.D.I necesita la camara para escanear codigos y validar accesos de forma inmediata.
            </Text>
            <ModernButton label="Otorgar permiso" tone="guard" icon="camera" onPress={requestPermission} />
          </View>
        </View>
        <GuardBottomDock active="scan" mode={mode} />
      </View>
    );
  }

  const statusTone = msg?.toLowerCase().includes("validando") ? theme.accent : theme.warning;

  return (
    <View style={[styles.root, { backgroundColor: theme.background[0] }]}>
      <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={isDark ? ["rgba(92,161,255,0.14)", "rgba(92,161,255,0.03)", "transparent"] : ["rgba(129,176,255,0.14)", "rgba(129,176,255,0.03)", "rgba(255,255,255,0.02)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.ambientTop}
      />
      <LinearGradient
        colors={isDark ? ["transparent", "rgba(29,107,201,0.08)", "transparent"] : ["transparent", "rgba(191,220,255,0.14)", "rgba(255,255,255,0.04)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ambientBeam}
      />
      <LinearGradient
        colors={isDark ? ["transparent", "rgba(74,146,239,0.06)", "rgba(74,146,239,0.01)"] : ["rgba(255,255,255,0.02)", "rgba(207,230,255,0.16)", "rgba(239,246,255,0.20)"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.ambientBottom}
      />
      <View style={[styles.content, { paddingTop: insets.top + 14, paddingBottom: 130 + Math.max(insets.bottom, 10) }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Escanear codigo</Text>
          <Text style={[styles.subtitle, { color: theme.textSoft }]}>Escanea el QR o ingresa el documento</Text>
        </View>

        <View style={styles.scanSection}>
          <View
            style={[
              styles.scannerShell,
              {
                backgroundColor: isDark ? "rgba(8,18,33,0.44)" : "rgba(255,255,255,0.44)",
                borderColor: theme.cardBorder,
                shadowColor: isDark ? theme.accentGlow : "rgba(99, 135, 215, 0.16)",
              },
            ]}
          >
            <View style={styles.scannerStage}>
              <CameraView
                key={cameraKey}
                style={styles.camera}
                barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
                onBarcodeScanned={(res) => {
                  void onBarcodeDetected(res.data || "");
                }}
              />
              <View pointerEvents="none" style={styles.scannerOverlay}>
                <View style={[styles.scanFrame, { borderColor: theme.accentGlow }]}>
                  <View style={[styles.corner, styles.topLeft, { borderColor: theme.accent }]} />
                  <View style={[styles.corner, styles.topRight, { borderColor: theme.accent }]} />
                  <View style={[styles.corner, styles.bottomLeft, { borderColor: theme.accent }]} />
                  <View style={[styles.corner, styles.bottomRight, { borderColor: theme.accent }]} />
                  {isProcessing ? <ActivityIndicator size="large" color={theme.accent} /> : null}
                </View>
              </View>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.manualSection,
            {
              backgroundColor: theme.sectionBg,
              borderColor: theme.summaryBorder,
            },
          ]}
        >
          <View style={styles.manualHeader}>
            <Text style={[styles.manualTitle, { color: theme.text }]}>Validacion manual</Text>
            {scanned ? (
              <Pressable onPress={reiniciarLectura} style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}>
                <Text style={[styles.resetText, { color: theme.accentStrong }]}>Leer otro codigo</Text>
              </Pressable>
            ) : null}
          </View>

          <InputField
            icon="id-card-outline"
            label="Documento"
            value={documento}
            onChangeText={(v) => setDocumento(normalizeScanValue(v))}
            placeholder="Ingresa documento o pega token firmado"
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {msg ? (
            <View style={[styles.feedbackRow, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.56)", borderColor: theme.summaryBorder }]}>
              <Ionicons name={statusTone === theme.warning ? "alert-circle-outline" : "checkmark-circle-outline"} size={18} color={statusTone} />
              <Text style={[styles.feedbackText, { color: statusTone }]}>{msg}</Text>
            </View>
          ) : null}

          <ModernButton
            icon="shield-checkmark"
            label={loading ? "Validando acceso..." : "Validar acceso"}
            tone="guard"
            disabled={loading || !documento.trim()}
            onPress={() => validar(documento)}
          />
        </View>
      </View>

      <GuardBottomDock active="scan" mode={mode} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionWrap: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: "center",
  },
  permissionCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    gap: 14,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  permissionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  permissionText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    marginBottom: 6,
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
    top: 116,
    left: -32,
    right: -32,
    height: 280,
    transform: [{ rotate: "-8deg" }],
  },
  ambientBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 108,
    height: 250,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  scanSection: {
    flex: 1,
    minHeight: 0,
  },
  scannerShell: {
    flex: 1,
    borderRadius: 28,
    borderWidth: 1,
    padding: 10,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  scannerStage: {
    flex: 1,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#020617",
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(3, 7, 18, 0.14)",
  },
  scanFrame: {
    width: "68%",
    aspectRatio: 1,
    maxWidth: 250,
    maxHeight: 250,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: "rgba(7, 16, 30, 0.10)",
  },
  corner: {
    position: "absolute",
    width: 26,
    height: 26,
    borderWidth: 0,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  manualSection: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  manualHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  manualTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  resetText: {
    fontSize: 13,
    fontWeight: "800",
  },
  feedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
});
