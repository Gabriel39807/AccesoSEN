import React, { useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";

import * as Accesos from "../../src/api/accesos";
import { toUiErrorMessage } from "../../src/api/client";
import { sanitizeDigits, validateDocument6to10 } from "../../src/lib/validators";
import { FadeInCard, InputField, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

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
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <ActivityIndicator />
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
    <ModernScreen scroll>
      <FadeInCard delay={0}>
        <Pill text="SCANNER INTELIGENTE" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock title="Escanear" subtitle="Alinea QR o codigo de barras dentro del marco." />
        </View>
      </FadeInCard>

      <FadeInCard delay={70} style={{ padding: 10 }}>
        <View style={{ borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#e2e8f0", height: 360 }}>
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
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 230,
              height: 230,
              marginLeft: -115,
              marginTop: -115,
              borderWidth: 3,
              borderColor: "rgba(20,184,166,0.95)",
              borderRadius: 20,
            }}
          />
        </View>
      </FadeInCard>

      <FadeInCard delay={120}>
        <InputField
          label="Documento"
          value={documento}
          onChangeText={(v) => setDocumento(sanitizeDigits(v).slice(0, 10))}
          placeholder="1053444048"
          keyboardType="numeric"
          maxLength={10}
        />

        {msg ? (
          <Text style={{ color: msg.toLowerCase().includes("detectado") ? "#0f766e" : "#b91c1c", marginTop: 8 }}>{msg}</Text>
        ) : null}

        <View style={{ gap: 8, marginTop: 10 }}>
          <ModernButton label={loading ? "Validando..." : "Validar"} disabled={loading} onPress={() => validar(documento)} />
          <ModernButton label="Leer otro QR" tone="light" onPress={reiniciarLectura} />
        </View>

        {loading ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
      </FadeInCard>
    </ModernScreen>
  );
}
