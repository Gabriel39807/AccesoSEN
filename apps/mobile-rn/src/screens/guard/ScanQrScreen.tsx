import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { GuardStackParamList } from "../../navigation/GuardStack";
import * as Accesos from "../../api/accesos";

type Props = NativeStackScreenProps<GuardStackParamList, "ScanQr">;
const BARCODE_TYPES: any[] = ["qr", "code128", "code39", "code93", "ean13", "ean8", "upc_a", "upc_e", "pdf417", "itf14"];

export function ScanQrScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();

  const [documento, setDocumento] = useState("");
  const [scanned, setScanned] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canScan = useMemo(() => !scanned && !loading, [scanned, loading]);

  async function validar() {
    const doc = documento.trim();
    if (!doc) {
      setMsg("Ingresa o escanea un documento.");
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const data = await Accesos.validarDocumento(doc);
      navigation.navigate("Confirmacion", { status: "ok", documento: doc, data });
    } catch (e: any) {
      const status = e?.response?.status;

      if (status === 404) {
        navigation.navigate("Confirmacion", { status: "notfound", documento: doc });
      } else {
        const motivo = e?.response?.data?.motivo || e?.response?.data?.detail || "Acceso denegado.";
        navigation.navigate("Confirmacion", { status: "denied", documento: doc, motivo });
      }
    } finally {
      setLoading(false);
    }
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
          Para escanear el QR del carnet debes permitir el acceso a la cámara.
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
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={(res) => {
            if (!canScan) return;
            setScanned(true);
            setDocumento(res.data);
            // Puedes auto-validar si quieres:
            // validar();
          }}
        />
        <View style={{ position: "absolute", top: 12, left: 12, right: 12, backgroundColor: "rgba(255,255,255,0.85)", padding: 10, borderRadius: 12 }}>
          <Text style={{ textAlign: "center", fontWeight: "700" }}>
            Alinea el código QR del carnet dentro del marco
          </Text>
        </View>
      </View>

      <TextInput
        value={documento}
        onChangeText={setDocumento}
        placeholder="Documento (ej: 1053444048)"
        keyboardType="numeric"
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
        onPress={() => setScanned(false)}
        style={{ padding: 10, alignItems: "center" }}
      >
        <Text style={{ opacity: 0.7 }}>Volver a escanear</Text>
      </Pressable>
    </View>
  );
}
