import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import * as Notifs from "../../src/api/notificaciones";
import { FadeInCard, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

export default function GuardAlertas() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Notifs.Notificacion[]>([]);

  async function load() {
    setLoading(true);
    try {
      const r = await Notifs.listar();
      setItems(r);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <ModernScreen scroll>
      <FadeInCard delay={0}>
        <Pill text="ALERTAS" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock title="Novedades" subtitle="Marca como leidas las alertas atendidas." />
        </View>
      </FadeInCard>

      <FadeInCard delay={70}>
        <ModernButton label={loading ? "Actualizando..." : "Actualizar"} tone="light" onPress={load} disabled={loading} />
      </FadeInCard>

      <FadeInCard delay={120}>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={items}
            scrollEnabled={false}
            keyExtractor={(i) => String(i.id)}
            renderItem={({ item }) => {
              const color = item.tipo === "URGENT" ? "#b91c1c" : item.tipo === "WARNING" ? "#b45309" : "#0f766e";
              return (
                <View
                  style={{
                    backgroundColor: "#f8fafc",
                    borderWidth: 1,
                    borderColor: "#e2e8f0",
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 10,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontWeight: "900", color: "#0f172a", flex: 1 }}>{item.titulo}</Text>
                    <View style={{ backgroundColor: color, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: "#fff", fontWeight: "900" }}>{item.tipo}</Text>
                    </View>
                  </View>
                  <Text style={{ color: "#475569" }}>{item.mensaje}</Text>
                  <Text style={{ color: "#64748b" }}>{new Date(item.created_at).toLocaleString()}</Text>
                  <ModernButton
                    label={item.read_at ? "Leida" : "Marcar como leida"}
                    tone={item.read_at ? "light" : "dark"}
                    onPress={async () => {
                      if (!item.read_at) await Notifs.marcarLeida(item.id);
                      load();
                    }}
                  />
                </View>
              );
            }}
            ListEmptyComponent={<Text style={{ color: "#64748b" }}>No hay alertas.</Text>}
          />
        )}
      </FadeInCard>
    </ModernScreen>
  );
}
