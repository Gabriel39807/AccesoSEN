/**
 * Scanner de guarda para QR/codigo de barras.
 *
 * Responsabilidad:
 * - Leer codigo de documento.
 * - Bloquear lecturas concurrentes mientras se procesa una validacion.
 * - Permitir reinicio manual seguro con "Leer otro QR".
 */
import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";

import * as Accesos from "../../src/api/accesos";
import { toUiErrorMessage } from "../../src/api/client";
import { isSignedScanToken, validateScanValue } from "../../src/lib/validators";
import { GuardBottomNav } from "../../src/ui/guard-bottom-nav";
import { FadeInCard, InputField, LoadingBlock, ModernButton, ModernScreen, NoticeBanner, Pill, TitleBlock, uiTheme } from "../../src/ui/modern";

const BARCODE_TYPES: any[] = ["qr", "code128", "code39", "code93", "ean13", "ean8", "upc_a", "upc_e", "pdf417", "itf14"];

function normalizeManualInput(value: string): string {
  const clean = String(value || "").trim();
  if (!clean) {
    return "";
  }
  if (isSignedScanToken(clean)) {
    return clean;
  }
  return clean.replace(/\D/g, "").slice(0, 10);
}

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const [documento, setDocumento] = useState("");
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canScan = useMemo(() => !scanned && !loading && !isProcessing, [scanned, loading, isProcessing]);
  const msgTone = msg?.toLowerCase().includes("detectado") ? "info" : "danger";
  const scanStateText = loading ? "Validando lectura" : scanned ? "Lectura bloqueada hasta confirmar o reiniciar" : "Camara lista para capturar credenciales";
  const scanStateColor = loading ? uiTheme.accentDeep : scanned ? uiTheme.warn : uiTheme.success;

  async function validar(doc: string) {
    const clean = doc.trim();
    const scanError = validateScanValue(clean);
    if (scanError) {
      setMsg(scanError);
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
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <FadeInCard>
          <LoadingBlock label="Preparando acceso a la camara" />
        </FadeInCard>
      </ModernScreen>
    );
  }

  if (!permission.granted) {
    return (
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <FadeInCard>
          <TitleBlock title="Permiso de camara" subtitle="Para escanear QR o codigo de barras debes habilitar la camara." />
          <View style={{ marginTop: 10 }}>
            <ModernButton label="Dar permiso" onPress={requestPermission} />
          </View>
        </FadeInCard>
      </ModernScreen>
    );
  }

  return (
    <ModernScreen scroll bottomAccessory={<GuardBottomNav />}>
      <FadeInCard delay={0} style={{ gap: 14 }}>
        <Pill text="SCANNER INTELIGENTE" />
        <TitleBlock title="Escanear" subtitle="Alinea el QR o el codigo dentro del marco para validar el acceso sin friccion." />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: scanStateColor }} />
          <Text style={{ color: scanStateColor, fontWeight: "900", fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase" }}>{scanStateText}</Text>
        </View>
      </FadeInCard>

      <FadeInCard delay={70} style={{ padding: 10, gap: 12 }}>
        <View style={{ borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: scanned ? "rgba(161,98,7,0.28)" : "rgba(148,163,184,0.26)", height: 380, backgroundColor: "#dbe5e7" }}>
          <CameraView
            key={cameraKey}
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            onBarcodeScanned={(res) => {
              if (!canScan) return;
              setScanned(true);
              setIsProcessing(true);
              setDocumento((res.data || "").trim());
              setMsg("Codigo detectado. Pulsa Validar o Leer otro QR.");
            }}
          />
          <View pointerEvents="none" style={[styles.overlayFrame, scanned ? styles.overlayFrameScanned : null]} />
        </View>
        <Text style={{ color: uiTheme.muted, lineHeight: 20 }}>
          El boton central de la barra siempre mantiene el scanner a un toque de distancia.
        </Text>
      </FadeInCard>

      <FadeInCard delay={120} style={{ gap: 12 }}>
        <InputField
          label="Documento o QR"
          value={documento}
          onChangeText={(v) => setDocumento(normalizeManualInput(v))}
          placeholder="1053444048 o QR firmado"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={220}
        />

        {msg ? <NoticeBanner tone={msgTone} text={msg} /> : null}

        <View style={{ gap: 8, marginTop: 6 }}>
          <ModernButton label={loading ? "Validando..." : "Validar"} icon="shield-checkmark-outline" disabled={loading} onPress={() => validar(documento)} />
          <ModernButton label="Leer otro QR" icon="refresh-outline" tone="light" onPress={reiniciarLectura} />
        </View>

        {loading ? <LoadingBlock label="Validando credencial escaneada" /> : null}
      </FadeInCard>
    </ModernScreen>
  );
}

const styles = {
  overlayFrame: {
    position: "absolute" as const,
    top: "50%" as const,
    left: "50%" as const,
    width: 234,
    height: 234,
    marginLeft: -117,
    marginTop: -117,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.95)",
    borderRadius: 28,
    shadowColor: uiTheme.accent,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  overlayFrameScanned: {
    borderColor: "rgba(250,204,21,0.95)",
    shadowColor: "rgba(161,98,7,0.8)",
  },
};
