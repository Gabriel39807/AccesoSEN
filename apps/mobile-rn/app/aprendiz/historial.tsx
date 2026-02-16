import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import { api } from "../../src/api/client";
import { FadeInCard, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

type AccesoItem = {
  id: number;
  tipo: "ingreso" | "salida";
  fecha: string;
  sede?: string;
};

export default function AprendizHistorial() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AccesoItem[]>([]);

  async function cargar() {
    setLoading(true);
    try {
      const r = await api.get<AccesoItem[]>("/api/accesos/mis_accesos/");
      setRows(Array.isArray(r.data) ? r.data : []);
    } catch {
      setRows([]);
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
        <Pill text="HISTORIAL" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock title="Tus movimientos" subtitle="Consulta entradas y salidas registradas." />
        </View>
      </FadeInCard>

      <FadeInCard delay={70}>
        <ModernButton label={loading ? "Actualizando..." : "Actualizar"} tone="light" onPress={cargar} disabled={loading} />
      </FadeInCard>

      <FadeInCard delay={120}>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={rows}
            scrollEnabled={false}
            keyExtractor={(i) => String(i.id)}
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: "#f8fafc",
                  borderWidth: 1,
                  borderColor: "#e2e8f0",
                  borderRadius: 12,
                  padding: 10,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontWeight: "900", color: "#0f172a" }}>{item.tipo.toUpperCase()}</Text>
                <Text style={{ color: "#64748b" }}>{new Date(item.fecha).toLocaleString()}</Text>
                <Text style={{ color: "#64748b" }}>Sede: {item.sede || "-"}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={{ color: "#64748b" }}>No hay registros de acceso.</Text>}
          />
        )}
      </FadeInCard>
    </ModernScreen>
  );
}
