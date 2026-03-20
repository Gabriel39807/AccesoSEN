/**
 * Scanner de guarda para QR/codigo de barras.
 *
 * Responsabilidad:
 * - Leer codigo de documento.
 * - Bloquear lecturas concurrentes mientras se procesa una validacion.
 * - Permitir reinicio manual seguro con "Leer otro QR".
 */
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Text, View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import * as Accesos from "../../src/api/accesos";
import { toUiErrorMessage } from "../../src/api/client";
import { sanitizeDigits, validateDocument6to10 } from "../../src/lib/validators";
import { FadeInCard, InputField, ModernButton, ModernScreen } from "../../src/ui/modern";

const BARCODE_TYPES: any[] = ["qr", "code128", "code39", "code93", "ean13", "ean8", "upc_a", "upc_e", "pdf417", "itf14"];

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const [documento, setDocumento] = useState("");
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canScan = useMemo(() => !scanned && !loading && !isProcessing, [scanned, loading, isProcessing]);

  async function validar(doc: string) {
    const clean = doc.trim();
    if (!clean) {
      setMsg("Ingresa o escanea un documento.");
      return;
    }
    const documentError = validateDocument6to10(clean);
    if (documentError) {
      setMsg(documentError);
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

  if (!permission) {
    return (
      <ModernScreen theme="guard" contentStyle={{ justifyContent: "center" }}>
        <ActivityIndicator color="#1e3a8a" size="large" />
      </ModernScreen>
    );
  }

  if (!permission.granted) {
    return (
      <ModernScreen theme="guard" contentStyle={{ justifyContent: "center" }}>
        <FadeInCard intensity={90} style={{ padding: 24, alignItems: "center" }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(239, 68, 68, 0.15)", justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
            <Ionicons name="camera-outline" size={32} color="#ef4444" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "900", color: "#0f172a", marginBottom: 8 }}>Permiso Denegado</Text>
          <Text style={{ textAlign: "center", color: "#64748b", marginBottom: 20, lineHeight: 22 }}>
            S.A.D.I requiere acceso a la cámara de tu dispositivo para poder escanear las identificaciones.
          </Text>
          <ModernButton label="Otorgar Permiso" tone="primary" onPress={requestPermission} icon="camera" />
        </FadeInCard>
      </ModernScreen>
    );
  }

  return (
    <ModernScreen scroll theme="guard">
      
      {/* Floating Sapphire Header Card */}
      <FadeInCard delay={0} intensity={100} style={styles.headerCard}>
        <LinearGradient
          colors={["rgba(30, 58, 138, 0.95)", "rgba(23, 37, 84, 0.95)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerContent}>
          <View>
            <View style={styles.badgeRow}>
              <Ionicons name="scan-outline" size={16} color="#38bdf8" />
              <Text style={styles.badgeText}>ESCÁNER INTELIGENTE</Text>
            </View>
            <Text style={styles.headerTitle}>Verificación</Text>
            <Text style={styles.headerSubtitle}>Alinea el código dentro del visor inteligente.</Text>
          </View>
          <ModernButton 
            icon="arrow-back" 
            label="" 
            tone="light" 
            onPress={() => router.back()} 
          />
        </View>
      </FadeInCard>

      {/* Cybernetic Viewfinder */}
      <FadeInCard delay={100} intensity={60} style={{ padding: 10, marginTop: 12 }}>
        <View style={styles.cameraFrame}>
          <CameraView
            key={cameraKey}
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            onBarcodeScanned={(res) => {
              if (!canScan) return;
              setScanned(true);
              setIsProcessing(true);
              setDocumento((res.data || "").trim());
              setMsg("Operación detectada. En validación...");
            }}
          />
          {/* Neon Target Reticle */}
          <View pointerEvents="none" style={styles.targetReticle}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            {isProcessing && (
              <ActivityIndicator color="#0ea5e9" size="large" style={{ marginTop: 80 }} />
            )}
          </View>
        </View>
      </FadeInCard>

      {/* Manual Fallback Form */}
      <FadeInCard delay={200} intensity={80} style={{ padding: 20, marginTop: 16, marginBottom: 40 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: "#475569", marginBottom: 16, textTransform: "uppercase" }}>Ingreso Manual</Text>
        
        <InputField
          icon="id-card-outline"
          label="Número de Documento"
          value={documento}
          onChangeText={(v) => setDocumento(sanitizeDigits(v).slice(0, 10))}
          placeholder="Ej. 1053444048"
          keyboardType="numeric"
          maxLength={10}
        />

        {msg && (
          <View style={[styles.msgBox, { backgroundColor: msg.includes("detectada") ? "rgba(16, 185, 129, 0.15)" : "rgba(225, 29, 72, 0.15)" }]}>
            <Ionicons name={msg.includes("detectada") ? "checkmark-circle" : "warning"} size={20} color={msg.includes("detectada") ? "#10b981" : "#e11d48"} />
            <Text style={[styles.msgText, { color: msg.includes("detectada") ? "#059669" : "#be123c" }]}>{msg}</Text>
          </View>
        )}

        <View style={{ gap: 12, marginTop: 24 }}>
          <ModernButton 
            icon="shield-checkmark" 
            label={loading ? "Verificando identidad..." : "Validar Acceso"} 
            tone="guard" 
            disabled={loading || !documento.trim()} 
            onPress={() => validar(documento)} 
          />
          {scanned && (
            <ModernButton 
              icon="refresh" 
              label="Leer otro código" 
              tone="light" 
              onPress={reiniciarLectura} 
            />
          )}
        </View>
      </FadeInCard>
    </ModernScreen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    padding: 24,
    overflow: "hidden",
    borderWidth: 0,
    shadowColor: "#0f172a",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  badgeText: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#bae6fd",
    marginTop: 4,
    fontWeight: "500",
  },
  cameraFrame: {
    height: 380,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000000",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)"
  },
  targetReticle: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 240,
    height: 240,
    marginLeft: -120,
    marginTop: -120,
    alignItems: "center",
    justifyContent: "center",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#0ea5e9", // Vivid Cyan
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
  msgBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  msgText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  }
});
