import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";

import * as Accesos from "../../src/api/accesos";
import { toUiErrorMessage } from "../../src/api/client";
import { sanitizeDigits, validateDocument6to10 } from "../../src/lib/validators";
import { EmptyState, FadeInCard, InputField, ModernButton, ModernScreen, NoticeBanner, Pill } from "../../src/ui/modern";

const BARCODE_TYPES: any[] = ["qr", "code128", "code39", "code93", "ean13", "ean8", "upc_a", "upc_e", "pdf417", "itf14"];

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [documento, setDocumento] = useState("");
  const [scanned, setScanned] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canScan = useMemo(() => !scanned && !loading, [scanned, loading]);

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
    setMsg("Validando identidad...");

    try {
      const data = await Accesos.validarDocumento(clean);
      Accesos.__cache.set(clean, data);
      router.push({ pathname: "/guard/confirmacion", params: { status: "ok", documento: clean } } as any);
    } catch (e: any) {
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

  function onBarcodeValue(raw: string) {
    if (!canScan) return;
    const clean = sanitizeDigits((raw || "").trim()).slice(0, 10);
    setDocumento(clean);
    setScanned(true);
    void validar(clean);
  }

  function reiniciarLectura() {
    setScanned(false);
    setLoading(false);
    setMsg(null);
    setDocumento("");
    setCameraKey((v) => v + 1);
  }

  if (!permission) {
    return (
      <ModernScreen theme="guard" contentStyle={{ justifyContent: "center" }}>
        <ActivityIndicator color="#6FD3FF" size="large" />
      </ModernScreen>
    );
  }

  if (!permission.granted) {
    return (
      <ModernScreen theme="guard" contentStyle={{ justifyContent: "center" }}>
        <FadeInCard intensity={85} style={styles.permissionCard}>
          <View style={styles.permissionIcon}>
            <Ionicons name="camera-outline" size={28} color="#FFD6DC" />
          </View>
          <Text style={styles.permissionTitle}>Permiso de camara requerido</Text>
          <Text style={styles.permissionSubtitle}>
            Activa la camara para abrir el visor operativo y validar accesos en tiempo real.
          </Text>
          <ModernButton label="Permitir camara" tone="guard" icon="camera-outline" onPress={() => void requestPermission()} />
        </FadeInCard>
      </ModernScreen>
    );
  }

  return (
    <ModernScreen scroll theme="guard">
      <FadeInCard delay={0} intensity={90} style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={{ flex: 1, gap: 10 }}>
            <Pill text="Scanner operativo" icon="scan-outline" tone="guard" />
            <View style={{ gap: 6 }}>
              <Text style={styles.heroTitle}>Verificacion inmediata</Text>
              <Text style={styles.heroSubtitle}>
                Alinea el QR o ingresa el documento manualmente. El resultado debe sentirse instantaneo y confiable.
              </Text>
            </View>
          </View>
          <ModernButton label="" tone="light" icon="arrow-back" onPress={() => router.back()} />
        </View>
      </FadeInCard>

      <FadeInCard delay={70} intensity={70} style={styles.viewfinderCard}>
        <View style={styles.viewfinderHeader}>
          <Text style={styles.sectionTitle}>Visor</Text>
          <Text style={styles.sectionCaption}>{loading ? "Procesando" : scanned ? "Lectura pausada" : "Listo"}</Text>
        </View>

        <View style={styles.cameraFrame}>
          <CameraView
            key={cameraKey}
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            onBarcodeScanned={(res) => onBarcodeValue(res.data || "")}
          />
          <View pointerEvents="none" style={styles.targetReticle}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            <View style={styles.reticleCore}>
              {loading ? <ActivityIndicator color="#6FD3FF" /> : <Ionicons name="scan-outline" size={28} color="rgba(243,247,251,0.9)" />}
            </View>
          </View>
        </View>

        <View style={styles.viewfinderFooter}>
          <View style={styles.footerMeta}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#B8C3D1" />
            <Text style={styles.footerMetaText}>Solo una lectura a la vez</Text>
          </View>
          {scanned ? <ModernButton icon="refresh-outline" label="Leer otro" tone="light" onPress={reiniciarLectura} /> : null}
        </View>
      </FadeInCard>

      <FadeInCard delay={140} intensity={72} style={styles.manualCard}>
        <View style={styles.manualHeader}>
          <Text style={styles.sectionTitle}>Fallback manual</Text>
          <Pill text="Documento" icon="card-outline" tone="primary" />
        </View>

        <InputField
          icon="id-card-outline"
          label="Numero de documento"
          value={documento}
          onChangeText={(value) => setDocumento(sanitizeDigits(value).slice(0, 10))}
          placeholder="Ej. 1053444048"
          keyboardType="numeric"
          maxLength={10}
        />

        {msg ? <NoticeBanner tone={msg.toLowerCase().includes("deneg") ? "danger" : "info"} text={msg} /> : null}

        <View style={styles.actionColumn}>
          <ModernButton
            icon="shield-checkmark-outline"
            label={loading ? "Validando..." : "Validar acceso"}
            tone="guard"
            disabled={loading || !documento.trim()}
            onPress={() => void validar(documento)}
          />
        </View>
      </FadeInCard>

      <FadeInCard delay={210} intensity={60} style={{ marginBottom: 40 }}>
        <EmptyState
          icon="information-circle-outline"
          title="Lectura controlada"
          subtitle="Si el QR falla, puedes usar el documento manual para mantener el flujo operativo sin perder claridad."
        />
      </FadeInCard>
    </ModernScreen>
  );
}

const styles = StyleSheet.create({
  permissionCard: {
    alignItems: "center",
    gap: 14,
  },
  permissionIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "rgba(255,107,122,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,107,122,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F3F7FB",
    textAlign: "center",
  },
  permissionSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#B8C3D1",
    textAlign: "center",
  },
  heroCard: {
    gap: 14,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    color: "#F3F7FB",
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#B8C3D1",
  },
  viewfinderCard: {
    gap: 14,
  },
  viewfinderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F3F7FB",
    letterSpacing: -0.4,
  },
  sectionCaption: {
    fontSize: 12,
    color: "#7F90A3",
    fontWeight: "600",
  },
  cameraFrame: {
    height: 410,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  targetReticle: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  reticleCore: {
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: "rgba(7,11,17,0.42)",
    borderWidth: 1,
    borderColor: "rgba(111,211,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  corner: {
    position: "absolute",
    width: 38,
    height: 38,
    borderColor: "#6FD3FF",
  },
  topLeft: { top: "24%", left: "18%", borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 18 },
  topRight: { top: "24%", right: "18%", borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 18 },
  bottomLeft: { bottom: "24%", left: "18%", borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 18 },
  bottomRight: { bottom: "24%", right: "18%", borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 18 },
  viewfinderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  footerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerMetaText: {
    fontSize: 12,
    color: "#B8C3D1",
    fontWeight: "600",
  },
  manualCard: {
    gap: 14,
  },
  manualHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  actionColumn: {
    gap: 10,
  },
});
