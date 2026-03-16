import React, { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import * as Turnos from "../../src/api/turnos";
import { useSessionStore } from "../../src/store/session";
import { EmptyState, FadeInCard, LoadingBlock, ModernButton, ModernScreen, NoticeBanner, Pill, uiTheme } from "../../src/ui/modern";

export default function CierreTurno() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id);

  const finalizarTurno = useSessionStore((s) => s.finalizarTurno);

  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<null | { turno: Turnos.Turno; resumen: { ingresos: number; salidas: number; total: number } }>(null);

  useEffect(() => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }

    let active = true;

    async function loadSummary() {
      setLoading(true);
      try {
        const r = await Turnos.resumenTurno(id);
        if (!active) return;
        if (!r.permitido) throw new Error(r.motivo || "No permitido");
        setData({ turno: r.turno, resumen: r.resumen });
      } catch {
        if (active) setData(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSummary();

    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  async function confirmarCierre() {
    Alert.alert("Confirmar cierre", "¿Seguro que deseas finalizar el turno?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Finalizar",
        style: "destructive",
        onPress: async () => {
          await finalizarTurno();
          router.replace("/guard/turno-finalizado" as any);
        },
      },
    ]);
  }

  if (loading) {
    return (
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <FadeInCard>
          <LoadingBlock label="Preparando resumen del turno" />
        </FadeInCard>
      </ModernScreen>
    );
  }

  if (!data) {
    return (
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <FadeInCard style={{ gap: 12 }}>
          <EmptyState
            icon="alert-circle-outline"
            title="Resumen no disponible"
            subtitle="No fue posible obtener el cierre operativo en este momento."
          />
          <NoticeBanner tone="danger" text="Verifica la conectividad o vuelve a intentarlo antes de finalizar el turno." />
          <ModernButton label="Reintentar" tone="dark" onPress={() => setReloadKey((current) => current + 1)} />
          <ModernButton label="Volver" icon="arrow-back-outline" tone="light" onPress={() => router.back()} />
        </FadeInCard>
      </ModernScreen>
    );
  }

  const statCards = [
    { label: "Ingresos", value: data.resumen.ingresos, tone: "rgba(15,118,110,0.08)", border: "rgba(15,118,110,0.14)", fg: uiTheme.accentDeep },
    { label: "Salidas", value: data.resumen.salidas, tone: "rgba(161,98,7,0.08)", border: "rgba(161,98,7,0.16)", fg: uiTheme.warn },
    { label: "Total", value: data.resumen.total, tone: "rgba(15,23,42,0.92)", border: "rgba(15,23,42,0.16)", fg: "#ffffff" },
  ];

  return (
    <ModernScreen scroll>
      <FadeInCard delay={0} style={{ gap: 16 }}>
        <Pill text="CIERRE DE TURNO" />
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
                Resumen operativo
              </Text>
              <Text style={{ color: "#ffffff", fontSize: 28, lineHeight: 32, fontWeight: "900", letterSpacing: -0.8 }}>
                Cierre de jornada listo para validar
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.76)", lineHeight: 20 }}>
                Sede {data.turno.sede} | Jornada {data.turno.jornada}
              </Text>
            </View>
            <View style={{ width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
              <Ionicons name="flag-outline" size={24} color="#ffffff" />
            </View>
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={70} style={{ gap: 12 }}>
        <NoticeBanner tone="info" text="Revisa este consolidado antes de cerrar. Después del cierre, el turno actual dejará de estar operativo para nuevas validaciones." />
        <Text style={{ color: uiTheme.inkSoft }}>Inicio: {new Date(data.turno.inicio).toLocaleString()}</Text>
        {data.turno.fin ? <Text style={{ color: uiTheme.inkSoft }}>Fin: {new Date(data.turno.fin).toLocaleString()}</Text> : null}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {statCards.map((item) => (
            <View
              key={item.label}
              style={{
                flex: 1,
                borderRadius: 22,
                padding: 14,
                backgroundColor: item.tone,
                borderWidth: 1,
                borderColor: item.border,
              }}
            >
              <Text style={{ color: item.fg === "#ffffff" ? "rgba(255,255,255,0.66)" : uiTheme.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
                {item.label}
              </Text>
              <Text style={{ color: item.fg, fontSize: 28, fontWeight: "900", marginTop: 8 }}>{item.value}</Text>
            </View>
          ))}
        </View>
      </FadeInCard>

      <FadeInCard delay={120} style={{ gap: 10 }}>
        <View style={{ borderRadius: 20, padding: 14, backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(148,163,184,0.22)" }}>
          <Text style={{ color: uiTheme.ink, fontWeight: "900", fontSize: 16 }}>Antes de confirmar</Text>
          <Text style={{ color: uiTheme.inkSoft, lineHeight: 20, marginTop: 6 }}>
            Verifica que los movimientos del turno sean correctos. Esta acción cerrará el periodo operativo actual y te llevará al cierre final de jornada.
          </Text>
        </View>
        <ModernButton label="Confirmar cierre" icon="checkmark-done-outline" tone="danger" onPress={confirmarCierre} />
        <ModernButton label="Volver" icon="arrow-back-outline" tone="light" onPress={() => router.back()} />
      </FadeInCard>
    </ModernScreen>
  );
}
