import React, { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { api } from "../../api/client";
import { GuardStackParamList } from "../../navigation/GuardStack";
import { useSessionStore } from "../../store/session";
import { useSystemBranding } from "../../theme/system-branding";
import { EmptyState, FadeInCard, ModernButton, ModernScreen, Pill, TitleBlock } from "../../ui/modern";

type Props = NativeStackScreenProps<GuardStackParamList, "GuardHome">;

type Acceso = {
  id: number;
  tipo: "ingreso" | "salida";
  fecha: string;
  usuario: number;
  sede?: string | null;
};

export function GuardHomeScreen({ navigation }: Props) {
  const user = useSessionStore((state) => state.user);
  const turno = useSessionStore((state) => state.turno);
  const finalizarTurno = useSessionStore((state) => state.finalizarTurno);
  const { config } = useSystemBranding();

  const [recientes, setRecientes] = useState<Acceso[]>([]);

  async function cargarRecientes() {
    try {
      const response = await api.get("/api/accesos/?page=1");
      const results = response.data?.results ?? [];
      setRecientes(results.slice(0, 5));
    } catch {
      setRecientes([]);
    }
  }

  useEffect(() => {
    cargarRecientes();
  }, []);

  async function onCerrarSesion() {
    await finalizarTurno();
    navigation.navigate("TurnoFinalizado");
  }

  return (
    <ModernScreen scroll contentStyle={{ gap: 14 }}>
      <FadeInCard style={{ gap: 16 }}>
        <Pill text="PANEL ACTIVO" />
        <TitleBlock
          title={config.nombre_institucion || "Panel de seguridad"}
          subtitle="Operación de ingresos, validación documental y control de turno."
        />
        <TitleBlock
          title={user?.first_name ? `${user.first_name} ${user.last_name ?? ""}`.trim() : user?.username || "Guardia"}
          subtitle={`Turno ${turno?.jornada ?? "-"} | Sede ${turno?.sede ?? "-"}`}
        />

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <ModernButton
              onPress={() => navigation.navigate("ScanQr")}
              label="Escanear entrada/salida"
              icon="scan-outline"
            />
          </View>
          <View style={{ flex: 1 }}>
            <ModernButton onPress={onCerrarSesion} label="Cerrar turno" tone="light" icon="log-out-outline" />
          </View>
        </View>
      </FadeInCard>

      <FadeInCard style={{ gap: 12 }}>
        <TitleBlock title="Registros recientes" subtitle="Últimos movimientos capturados desde este dispositivo." />
        <FlatList
          data={recientes}
          keyExtractor={(item) => String(item.id)}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View
              style={{
                borderWidth: 1,
                borderColor: "rgba(148,163,184,0.22)",
                borderRadius: 18,
                padding: 14,
                marginBottom: 10,
                backgroundColor: "rgba(255,255,255,0.76)",
              }}
            >
              <TitleBlock title={`#${item.id} · ${item.tipo.toUpperCase()}`} subtitle={new Date(item.fecha).toLocaleString()} />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="time-outline"
              title="Aún no hay registros"
              subtitle="Cuando captures ingresos o salidas aparecerán aquí para seguimiento rápido."
            />
          }
        />
      </FadeInCard>
    </ModernScreen>
  );
}
