import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";

import { api, toUiErrorMessage } from "../../src/api/client";
import { FadeInCard, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

type QrResponse = {
  permitido: boolean;
  motivo: string | null;
  documento?: string;
  qr_value?: string;
  qr_png_base64?: string;
  algoritmo?: string;
};

export default function MiQrScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QrResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
    cargar();
  }, []);

  return (
    <ModernScreen scroll>
      <FadeInCard>
        <Pill text="MI QR" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock title="Codigo de acceso" subtitle="Generado a partir de tu documento para validacion en porteria." />
        </View>
      </FadeInCard>

      <FadeInCard delay={70}>
        <ModernButton label={loading ? "Actualizando..." : "Actualizar QR"} tone="light" onPress={cargar} disabled={loading} />
        {loading ? <ActivityIndicator style={{ marginTop: 10 }} /> : null}
        {msg ? <Text style={{ color: "#b91c1c", marginTop: 8 }}>{msg}</Text> : null}
      </FadeInCard>

      {!loading && data?.qr_png_base64 ? (
        <FadeInCard delay={120}>
          <View style={{ alignItems: "center", gap: 8 }}>
            <Image
              source={{ uri: `data:image/png;base64,${data.qr_png_base64}` }}
              style={{ width: 260, height: 260, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0" }}
              resizeMode="contain"
            />
            <Text style={{ color: "#0f172a", fontWeight: "800" }}>Documento: {data.documento || "-"}</Text>
          </View>
        </FadeInCard>
      ) : null}
    </ModernScreen>
  );
}
