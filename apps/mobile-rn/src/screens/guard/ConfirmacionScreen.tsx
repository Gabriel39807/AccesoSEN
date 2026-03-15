import React, { useMemo, useState } from "react";
import { Alert, FlatList, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import * as Accesos from "../../api/accesos";
import { toUiErrorMessage } from "../../api/client";
import { GuardStackParamList } from "../../navigation/GuardStack";
import { EmptyState, FadeInCard, ModernButton, ModernScreen, NoticeBanner, Pill, TitleBlock } from "../../ui/modern";

type Props = NativeStackScreenProps<GuardStackParamList, "Confirmacion">;

export function ConfirmacionScreen({ navigation, route }: Props) {
  const params = route.params;
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const equipos = useMemo(() => {
    if (params.status !== "ok") return [];
    return params.data.equipos_aprobados ?? [];
  }, [params]);

  function toggleEquipo(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  async function registrar(tipo: "ingreso" | "salida") {
    try {
      setLoading(true);
      await Accesos.registrarPorDocumento({
        documento: params.documento,
        tipo,
        equipos: selected,
      });
      Alert.alert("Listo", `Se registro ${tipo} correctamente.`);
      navigation.popToTop();
    } catch (error: any) {
      const motivo = toUiErrorMessage(error, "No se pudo registrar el acceso.");
      Alert.alert("No permitido", motivo);
    } finally {
      setLoading(false);
    }
  }

  if (params.status === "notfound") {
    return (
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <FadeInCard style={{ gap: 18 }}>
          <Pill text="ACCESO DENEGADO" />
          <TitleBlock
            title="Usuario no encontrado"
            subtitle="La informacion escaneada no corresponde a un usuario registrado."
          />
          <ModernButton label="Volver a escanear" tone="danger" onPress={() => navigation.goBack()} />
        </FadeInCard>
      </ModernScreen>
    );
  }

  if (params.status === "denied") {
    return (
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <FadeInCard style={{ gap: 18 }}>
          <Pill text="ACCESO DENEGADO" />
          <TitleBlock title="Movimiento rechazado" subtitle={params.motivo} />
          <ModernButton label="Volver a escanear" tone="danger" onPress={() => navigation.goBack()} />
        </FadeInCard>
      </ModernScreen>
    );
  }

  const aprendiz = params.data.aprendiz;

  return (
    <ModernScreen scroll contentStyle={{ gap: 14 }}>
      <FadeInCard style={{ gap: 16 }}>
        <Pill text="ACCESO AUTORIZADO" />
        <TitleBlock
          title={`${aprendiz.first_name} ${aprendiz.last_name}`.trim()}
          subtitle={`Documento ${aprendiz.documento}`}
        />
      </FadeInCard>

      <FadeInCard style={{ gap: 14 }}>
        <TitleBlock
          title="Checklist de equipos"
          subtitle="Marca los equipos que acompanaran este movimiento antes de confirmar ingreso o salida."
        />
        <FlatList
          data={equipos}
          scrollEnabled={false}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const checked = selected.includes(item.id);
            return (
              <View
                style={{
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: checked ? "rgba(15,118,110,0.22)" : "rgba(148,163,184,0.22)",
                  backgroundColor: checked ? "rgba(15,118,110,0.08)" : "rgba(255,255,255,0.76)",
                  padding: 14,
                  marginBottom: 10,
                  gap: 8,
                }}
              >
                <TitleBlock title={`${item.marca} ${item.modelo}`.trim()} subtitle={`Serial ${item.serial}`} />
                <ModernButton
                  label={checked ? "Quitar equipo" : "Asociar equipo"}
                  tone={checked ? "primary" : "light"}
                  onPress={() => toggleEquipo(item.id)}
                />
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="No hay equipos aprobados"
              subtitle="Este movimiento no tiene equipos habilitados para asociar."
            />
          }
        />
      </FadeInCard>

      <FadeInCard style={{ gap: 10 }}>
        <NoticeBanner
          tone="info"
          text={
            selected.length > 0
              ? `${selected.length} equipo(s) asociado(s) para este registro.`
              : "Puedes registrar el acceso sin equipos o asociarlos antes de confirmar."
          }
        />
        <ModernButton label="Registrar ingreso" onPress={() => registrar("ingreso")} disabled={loading} />
        <ModernButton label="Registrar salida" tone="danger" onPress={() => registrar("salida")} disabled={loading} />
      </FadeInCard>
    </ModernScreen>
  );
}
