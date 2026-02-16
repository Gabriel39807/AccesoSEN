import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Turnos from "../../src/api/turnos";
import { useSessionStore } from "../../src/store/session";
import { FadeInCard, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

export default function CierreTurno() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id);

  const finalizarTurno = useSessionStore((s) => s.finalizarTurno);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<null | { turno: Turnos.Turno; resumen: { ingresos: number; salidas: number; total: number } }>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await Turnos.resumenTurno(id);
      if (!r.permitido) throw new Error(r.motivo || "No permitido");
      setData({ turno: r.turno, resumen: r.resumen });
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function confirmarCierre() {
    Alert.alert("Confirmar cierre", "Seguro que deseas finalizar el turno?", [
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
        <ActivityIndicator />
      </ModernScreen>
    );
  }

  if (!data) {
    return (
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <FadeInCard>
          <TitleBlock title="No se pudo cargar" subtitle="El resumen del turno no esta disponible." />
          <View style={{ marginTop: 12, gap: 8 }}>
            <ModernButton label="Reintentar" tone="dark" onPress={load} />
            <ModernButton label="Volver" tone="light" onPress={() => router.back()} />
          </View>
        </FadeInCard>
      </ModernScreen>
    );
  }

  return (
    <ModernScreen scroll>
      <FadeInCard>
        <Pill text="CIERRE DE TURNO" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock title="Resumen operativo" subtitle={`Sede ${data.turno.sede} - Jornada ${data.turno.jornada}`} />
        </View>
      </FadeInCard>

      <FadeInCard delay={70}>
        <Text style={{ color: "#475569" }}>Inicio: {new Date(data.turno.inicio).toLocaleString()}</Text>
        {data.turno.fin ? <Text style={{ color: "#475569" }}>Fin: {new Date(data.turno.fin).toLocaleString()}</Text> : null}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#64748b" }}>Ingresos</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#0f172a" }}>{data.resumen.ingresos}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#64748b" }}>Salidas</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#0f172a" }}>{data.resumen.salidas}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#64748b" }}>Total</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#0f172a" }}>{data.resumen.total}</Text>
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={120}>
        <View style={{ gap: 8 }}>
          <ModernButton label="Confirmar cierre" tone="danger" onPress={confirmarCierre} />
          <ModernButton label="Volver" tone="light" onPress={() => router.back()} />
        </View>
      </FadeInCard>
    </ModernScreen>
  );
}
