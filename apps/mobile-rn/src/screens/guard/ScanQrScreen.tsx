import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { GuardStackParamList } from "../../navigation/GuardStack";
import * as Accesos from "../../api/accesos";
import { toUiErrorMessage } from "../../api/client";
import { sanitizeDigits, validateDocument6to10 } from "../../lib/validators";

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

  const canScan = useMemo(() => !scanned && !loading && !isProcessing, [scanned, loading, isProcessing]);

  async function validar() {
    const doc = documento.trim();
    if (!doc) {
      setMsg("Ingresa o escanea un documento.");
      return;
    }
    const documentError = validateDocument6to10(doc);
    if (documentError) {
      setMsg(documentError);
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const data = await Accesos.validarDocumento(doc);
      navigation.navigate("Confirmacion", { status: "ok", documento: doc, data });
    } catch (e: any) {
      setIsProcessing(false);
      const status = e?.response?.status;

      if (status === 404) {
        navigation.navigate("Confirmacion", { status: "notfound", documento: doc });
      } else {
        const motivo = toUiErrorMessage(e, "Acceso denegado.");
        navigation.navigate("Confirmacion", { status: "denied", documento: doc, motivo });
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "800" }}>Permiso de cámara requerido</Text>
        <Text style={{ opacity: 0.7 }}>
          Para escanear QR o codigo de barras debes permitir el acceso a la camara.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={{ backgroundColor: "#16a34a", padding: 14, borderRadius: 999, alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>Dar permiso</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <View style={{ borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#eee", flex: 1 }}>
        <CameraView
          key={cameraKey}
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={(res) => {
            if (!canScan) return;
            setScanned(true);
            setIsProcessing(true);
            setDocumento((res.data || "").trim());
            setMsg("Codigo detectado. Pulsa Digitar para validar o Leer otro QR.");
          }}
        />
        <View style={{ position: "absolute", top: 12, left: 12, right: 12, backgroundColor: "rgba(255,255,255,0.85)", padding: 10, borderRadius: 12 }}>
          <Text style={{ textAlign: "center", fontWeight: "700" }}>
            Alinea el QR o codigo de barras dentro del marco
          </Text>
        </View>
      </View>

      <TextInput
        value={documento}
        onChangeText={(v) => setDocumento(sanitizeDigits(v).slice(0, 10))}
        placeholder="Documento (ej: 1053444048)"
        keyboardType="numeric"
        maxLength={10}
        style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 14, padding: 12, backgroundColor: "#fff" }}
      />

      {msg ? <Text style={{ color: "red" }}>{msg}</Text> : null}

      <Pressable
        disabled={loading}
        onPress={validar}
        style={{ backgroundColor: loading ? "#6b7280" : "#e5e7eb", padding: 14, borderRadius: 999, alignItems: "center" }}
      >
        {loading ? <ActivityIndicator /> : <Text style={{ fontWeight: "900" }}>Digitar</Text>}
      </Pressable>

      <Pressable
        onPress={reiniciarLectura}
        style={{ padding: 10, alignItems: "center" }}
      >
        <Text style={{ opacity: 0.7 }}>Leer otro QR</Text>
      </Pressable>
    </View>
  );
}
