import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";

import * as Accesos from "../../src/api/accesos";

const BARCODE_TYPES: any[] = ["qr", "code128", "code39", "code93", "ean13", "ean8", "upc_a", "upc_e", "pdf417", "itf14"];

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const [documento, setDocumento] = useState("");
  const [scanned, setScanned] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canScan = useMemo(() => !scanned && !loading, [scanned, loading]);

  async function validar(doc: string) {
    const clean = doc.trim();
    if (!clean) {
      setMsg("Ingresa o escanea un documento.");
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const data = await Accesos.validarDocumento(clean);

      // Cache simple para la pantalla de confirmación
      Accesos.__cache.set(clean, data);

      // FIX: typed routes no acepta params aquí (aunque la ruta exista)
      router.push(
        {
          pathname: "/guard/confirmacion",
          params: { status: "ok", documento: clean },
        } as any
      );
    } catch (e: any) {
      const status = e?.response?.status;

      if (status === 404) {
        router.push(
          {
            pathname: "/guard/confirmacion",
            params: { status: "notfound", documento: clean },
          } as any
        );
      } else {
        const motivo =
          e?.response?.data?.motivo ||
          e?.response?.data?.detail ||
          "Acceso denegado.";

        router.push(
          {
            pathname: "/guard/confirmacion",
            params: { status: "denied", documento: clean, motivo },
          } as any
        );
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
        <Text style={{ fontSize: 18, fontWeight: "900" }}>
          Permiso de cámara requerido
        </Text>
        <Text style={{ opacity: 0.7 }}>
          Para escanear el QR del carnet debes permitir el acceso a la cámara.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={{
            backgroundColor: "#16a34a",
            padding: 14,
            borderRadius: 999,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Dar permiso</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <View
        style={{
          flex: 1,
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "#eee",
        }}
      >
              {/* Marco visual */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 240,
            height: 240,
            marginLeft: -120,
            marginTop: -120,
            borderRadius: 24,
            borderWidth: 4,
            borderColor: "rgba(22,163,74,0.95)",
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 220,
            height: 220,
            marginLeft: -110,
            marginTop: -110,
            borderRadius: 20,
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.85)",
          }}
        />

        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={(res) => {
            if (!canScan) return;
            setScanned(true);
            setDocumento(res.data);
            validar(res.data);
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
            borderRadius: 12,
          }}
        >
          <Text style={{ textAlign: "center", fontWeight: "900" }}>
            Alinea el QR del carnet dentro del marco
          </Text>
        </View>
      </View>

      <TextInput
        value={documento}
        onChangeText={setDocumento}
        placeholder="Documento (ej: 1053444048)"
        keyboardType="numeric"
        style={{
          borderWidth: 1,
          borderColor: "#eee",
          borderRadius: 14,
          padding: 12,
          backgroundColor: "#fff",
        }}
      />

      {msg ? <Text style={{ color: "red" }}>{msg}</Text> : null}

      <Pressable
        disabled={loading}
        onPress={() => validar(documento)}
        style={{
          backgroundColor: loading ? "#6b7280" : "#e5e7eb",
          padding: 14,
          borderRadius: 999,
          alignItems: "center",
        }}
      >
        {loading ? (
          <ActivityIndicator />
        ) : (
          <Text style={{ fontWeight: "900" }}>Digitar</Text>
        )}
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
