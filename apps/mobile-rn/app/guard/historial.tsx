import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { api } from "../../src/api/client";
import { FadeInCard, InputField, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

type Row = { id: number; tipo: "ingreso" | "salida"; fecha: string };

function dayKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString();
}

export default function GuardHistorial() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  async function buscar() {
    setLoading(true);
    try {
      const url = `/api/accesos/?page=1${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`;
      const r = await api.get(url);
      setRows((r.data?.results ?? []) as Row[]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const k = dayKey(r.fecha);
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return Array.from(map.entries()).map(([dia, items]) => ({ dia, items }));
  }, [rows]);

  return (
    <ModernScreen scroll>
      <FadeInCard delay={0}>
        <Pill text="HISTORIAL" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock title="Registros de acceso" subtitle="Filtra por documento, nombre o serial." />
        </View>
      </FadeInCard>

      <FadeInCard delay={70}>
        <InputField value={q} onChangeText={setQ} label="Buscar" placeholder="Documento, nombre o serial" />
        <View style={{ marginTop: 10 }}>
          <ModernButton label={loading ? "Buscando..." : "Filtrar"} onPress={buscar} disabled={loading} />
        </View>
      </FadeInCard>

      <FadeInCard delay={120}>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={grouped}
            scrollEnabled={false}
            keyExtractor={(i) => i.dia}
            renderItem={({ item }) => (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontWeight: "900", color: "#0f172a", marginBottom: 6 }}>{item.dia}</Text>
                {item.items.map((r) => (
                  <View
                    key={r.id}
                    style={{
                      backgroundColor: "#f8fafc",
                      borderWidth: 1,
                      borderColor: "#e2e8f0",
                      borderRadius: 12,
                      padding: 10,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: "#0f172a" }}>
                      #{r.id} - {r.tipo.toUpperCase()}
                    </Text>
                    <Text style={{ color: "#64748b" }}>{new Date(r.fecha).toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            )}
            ListEmptyComponent={<Text style={{ color: "#64748b" }}>No hay resultados.</Text>}
          />
        )}
      </FadeInCard>
    </ModernScreen>
  );
}
