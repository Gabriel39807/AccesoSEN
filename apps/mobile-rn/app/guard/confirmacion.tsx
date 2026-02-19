import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import * as Accesos from "../../src/api/accesos";
import { toUiErrorMessage } from "../../src/api/client";
import { FadeInCard, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

export default function ConfirmacionScreen() {
  const params = useLocalSearchParams<{
    status: "ok" | "notfound" | "denied";
    documento: string;
    motivo?: string;
  }>();

  const documento = params.documento ?? "";
  const status = params.status;
  const data = status === "ok" ? Accesos.__cache.get(documento) : null;

  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const equipos = useMemo(() => data?.equipos_aprobados ?? [], [data]);

  function toggleEquipo(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function registrar(tipo: "ingreso" | "salida") {
    try {
      setLoading(true);
      await Accesos.registrarPorDocumento({ documento, tipo, equipos: selected });
      Alert.alert("Listo", `Se registro ${tipo} correctamente.`);
      router.replace("/guard/home");
    } catch (e: any) {
      const motivo = toUiErrorMessage(e, "No se pudo registrar el acceso.");
      Alert.alert("No permitido", motivo);
    } finally {
      setLoading(false);
    }
  }

  if (!status) return null;

  if (status === "notfound") {
    return (
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <FadeInCard>
          <TitleBlock title="Acceso denegado" subtitle="Usuario no encontrado" />
          <Text style={{ color: "#64748b", marginTop: 6 }}>
            La informacion escaneada no corresponde a un usuario registrado.
          </Text>
          <View style={{ marginTop: 12 }}>
            <ModernButton label="Volver a escanear" tone="danger" onPress={() => router.back()} />
          </View>
        </FadeInCard>
      </ModernScreen>
    );
  }

  if (status === "denied") {
    return (
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <FadeInCard>
          <TitleBlock title="Acceso denegado" subtitle="Motivo del rechazo" />
          <Text style={{ color: "#64748b", marginTop: 6 }}>{params.motivo ?? "Acceso denegado."}</Text>
          <View style={{ marginTop: 12 }}>
            <ModernButton label="Volver a escanear" tone="danger" onPress={() => router.back()} />
          </View>
        </FadeInCard>
      </ModernScreen>
    );
  }

  if (!data) {
    return (
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <ActivityIndicator />
      </ModernScreen>
    );
  }

  const a = data.aprendiz;

  return (
    <ModernScreen scroll>
      <FadeInCard delay={0}>
        <Pill text="ACCESO AUTORIZADO" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock title={`${a.first_name} ${a.last_name}`} subtitle={`Documento ${a.documento}`} />
        </View>
      </FadeInCard>

      <FadeInCard delay={70}>
        <Text style={{ fontWeight: "900", color: "#0f172a", marginBottom: 8 }}>Checklist de equipos</Text>
        <FlatList
          data={equipos}
          scrollEnabled={false}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item }) => {
            const checked = selected.includes(item.id);
            return (
              <ModernButton
                label={`${checked ? "[OK]" : "[ ]"} ${item.marca} ${item.modelo} - ${item.serial}`}
                tone="light"
                onPress={() => toggleEquipo(item.id)}
              />
            );
          }}
          ListEmptyComponent={<Text style={{ color: "#64748b" }}>No hay equipos aprobados.</Text>}
        />
      </FadeInCard>

      <FadeInCard delay={120}>
        <View style={{ gap: 8 }}>
          <ModernButton label="Registrar ingreso" onPress={() => registrar("ingreso")} disabled={loading} />
          <ModernButton label="Registrar salida" tone="danger" onPress={() => registrar("salida")} disabled={loading} />
          {loading ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
        </View>
      </FadeInCard>
    </ModernScreen>
  );
}
