import React, { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { api, toUiErrorMessage } from "../../src/api/client";
import { EmptyState, FadeInCard, LoadingBlock, ModernButton, ModernScreen, NoticeBanner, Pill, SkeletonCard, SkeletonLine, TitleBlock } from "../../src/ui/modern";

type QrResponse = {
  permitido: boolean;
  motivo: string | null;
  documento?: string;
  qr_value?: string;
  qr_png_base64?: string;
  algoritmo?: string;
};

const qrHighlights = [
  { title: "Dinamico", detail: "Se genera desde tu perfil actual." },
  { title: "Verificable", detail: "Se valida en porteria antes del acceso." },
  { title: "Rapido", detail: "Listo para mostrar apenas abras esta vista." },
];

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
    void cargar();
  }, []);

  return (
    <ModernScreen scroll>
      <FadeInCard delay={0} style={{ gap: 16 }}>
        <Pill text="MI QR" />
        <View
          style={{
            borderRadius: 30,
            backgroundColor: "rgba(15,23,42,0.92)",
            borderWidth: 1,
            borderColor: "rgba(15,23,42,0.16)",
            padding: 18,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={{ color: "rgba(255,255,255,0.62)", fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
                Identidad digital
              </Text>
              <Text style={{ color: "#ffffff", fontSize: 28, lineHeight: 32, fontWeight: "900", letterSpacing: -0.8 }}>
                Codigo de acceso personal
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.76)", lineHeight: 20 }}>
                Generado a partir de tu perfil para presentarlo en porteria de forma clara, segura y rapida.
              </Text>
            </View>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.08)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
              }}
            >
              <Ionicons name="qr-code-outline" size={24} color="#ffffff" />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {qrHighlights.map((item) => (
              <View key={item.title} style={{ flex: 1, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: 14 }}>{item.title}</Text>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 6, lineHeight: 17 }}>{item.detail}</Text>
              </View>
            ))}
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={70} style={{ gap: 10 }}>
        <ModernButton label={loading ? "Actualizando..." : "Actualizar QR"} icon="refresh-outline" tone="light" onPress={cargar} disabled={loading} />
        {loading ? <LoadingBlock label="Generando codigo de acceso" /> : null}
        {msg ? <NoticeBanner tone="danger" text={msg} /> : null}
      </FadeInCard>

      {loading ? (
        <FadeInCard delay={120} style={{ gap: 16, alignItems: "center" }}>
          <View style={{ padding: 18, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.9)", borderWidth: 1, borderColor: "rgba(148,163,184,0.2)" }}>
            <View style={{ width: 256, height: 256, borderRadius: 16, backgroundColor: "rgba(148,163,184,0.12)", alignItems: "center", justifyContent: "center" }}>
              <SkeletonLine width={180} height={180} />
            </View>
          </View>
          <View style={{ width: "100%", gap: 10, alignItems: "center" }}>
            <SkeletonLine width="46%" height={24} />
            <SkeletonLine width="62%" height={14} />
          </View>
          <SkeletonCard rows={2} />
        </FadeInCard>
      ) : null}

      {!loading && data?.qr_png_base64 ? (
        <FadeInCard delay={120} style={{ gap: 14 }}>
          <View style={{ alignItems: "center", gap: 12 }}>
            <View style={{ padding: 18, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.9)", borderWidth: 1, borderColor: "rgba(148,163,184,0.2)" }}>
              <Image
                source={{ uri: `data:image/png;base64,${data.qr_png_base64}` }}
                style={{ width: 256, height: 256, borderRadius: 16 }}
                resizeMode="contain"
              />
            </View>
            <TitleBlock title="Listo para mostrar" subtitle={`Documento ${data.documento || "-"}${data.algoritmo ? ` | ${data.algoritmo}` : ""}`} />
          </View>
        </FadeInCard>
      ) : null}

      {!loading && !data?.qr_png_base64 && !msg ? (
        <FadeInCard delay={120}>
          <EmptyState
            icon="qr-code-outline"
            title="QR no disponible"
            subtitle="Todavia no fue posible generar tu codigo. Intenta actualizar nuevamente en unos segundos."
          />
        </FadeInCard>
      ) : null}
    </ModernScreen>
  );
}
