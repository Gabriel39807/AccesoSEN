import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import * as Accesos from "../../api/accesos";
import { toUiErrorMessage } from "../../api/client";
import { GuardStackParamList } from "../../navigation/GuardStack";
import { isSignedScanToken, sanitizeDigits, validateScanValue } from "../../lib/validators";
import { FadeInCard, ModernButton, ModernScreen, NoticeBanner, Pill, TitleBlock } from "../../ui/modern";

type Props = NativeStackScreenProps<GuardStackParamList, "ScanQr">;

const BARCODE_TYPES: any[] = ["qr", "code128", "code39", "code93", "ean13", "ean8", "upc_a", "upc_e", "pdf417", "itf14"];

export function ScanQrScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [documento, setDocumento] = useState("");
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const canScan = useMemo(() => !scanned && !loading && !isProcessing, [scanned, loading, isProcessing]);

  function normalizeScanInput(value: string) {
    const clean = String(value || "").trim();
    return isSignedScanToken(clean) ? clean : sanitizeDigits(clean).slice(0, 10);
  }

  async function validar(rawValue?: string) {
    if (inFlightRef.current) return;
    const doc = String(rawValue ?? documento).trim();
    const documentError = validateScanValue(doc);
    if (documentError) {
      setMsg(documentError);
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setMsg("Validando identidad...");

    try {
      const data = await Accesos.validarDocumento(doc);
      if (data.estado === "dentro") {
        navigation.navigate("Confirmacion", { status: "ok", documento: doc, data, flow: "manual-salida" });
        return;
      }
      setMsg("Identidad validada. Registrando ingreso...");
      await Accesos.registrarPorDocumento(
        { documento: doc, tipo: "ingreso" },
        { idempotencyKey: Accesos.createRegistroIdempotencyKey(doc, "ingreso") }
      );
      navigation.navigate("Confirmacion", { status: "ok", documento: doc, data, flow: "auto-ingreso" });
    } catch (error: any) {
      setIsProcessing(false);
      const status = error?.response?.status;

      if (status === 404) {
        navigation.navigate("Confirmacion", { status: "notfound", documento: doc });
      } else {
        const motivo = toUiErrorMessage(error, "Acceso denegado.");
        navigation.navigate("Confirmacion", { status: "denied", documento: doc, motivo });
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }

  function reiniciarLectura() {
    setScanned(false);
    setIsProcessing(false);
    setLoading(false);
    setMsg(null);
    setDocumento("");
    setCameraKey((value) => value + 1);
  }

  if (!permission) {
    return (
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <FadeInCard>
          <ActivityIndicator />
        </FadeInCard>
      </ModernScreen>
    );
  }

  if (!permission.granted) {
    return (
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <FadeInCard style={{ gap: 16 }}>
          <Pill text="CÁMARA" />
          <TitleBlock
            title="Permiso de cámara requerido"
            subtitle="Para escanear QR o código de barras debes permitir el acceso a la cámara."
          />
          <ModernButton onPress={requestPermission} label="Dar permiso" icon="camera-outline" />
        </FadeInCard>
      </ModernScreen>
    );
  }

  return (
    <ModernScreen scroll contentStyle={{ gap: 14 }}>
      <FadeInCard style={{ gap: 14 }}>
        <Pill text="ESCANEO" />
        <TitleBlock
          title="Validación de acceso"
          subtitle="Alinea el QR o código dentro del marco. Si hace falta, puedes digitar el documento."
        />
        <View style={{ borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", height: 360 }}>
          <CameraView
            key={cameraKey}
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            onBarcodeScanned={(result) => {
                if (!canScan) return;
                const normalized = normalizeScanInput(result.data || "");
                setScanned(true);
                setIsProcessing(true);
                setDocumento(normalized);
                void validar(normalized);
              }}
            />
          <View
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              right: 12,
              backgroundColor: "rgba(255,255,255,0.85)",
              padding: 10,
              borderRadius: 14,
            }}
          >
            <Text style={{ textAlign: "center", fontWeight: "700" }}>Alinea el QR o código de barras dentro del marco</Text>
          </View>
        </View>
      </FadeInCard>

      <FadeInCard style={{ gap: 14 }}>
        <TitleBlock title="Documento manual" subtitle="Usa este campo cuando el QR esté dañado o no sea legible." />
        <TextInput
          value={documento}
          onChangeText={(value) => setDocumento(sanitizeDigits(value).slice(0, 10))}
          placeholder="Documento (ej: 1053444048)"
          keyboardType="numeric"
          maxLength={10}
          style={{
            borderWidth: 1,
            borderColor: "rgba(148,163,184,0.3)",
            borderRadius: 20,
            padding: 14,
            backgroundColor: "rgba(255,255,255,0.9)",
          }}
        />
        {msg ? <NoticeBanner tone="info" text={msg} /> : null}
        <ModernButton
          disabled={loading}
          onPress={() => void validar()}
          label={loading ? "Validando..." : "Validar documento"}
          tone="primary"
          icon="checkmark-circle-outline"
        />
        <ModernButton onPress={reiniciarLectura} label="Leer otro QR" tone="light" icon="refresh-outline" />
      </FadeInCard>
    </ModernScreen>
  );
}
