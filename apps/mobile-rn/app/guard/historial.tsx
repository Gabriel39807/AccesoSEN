import React, { useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";

import { api } from "../../src/api/client";
import { GuardBottomNav } from "../../src/ui/guard-bottom-nav";
import { EmptyState, FadeInCard, InputField, ModernButton, ModernScreen, Pill, SkeletonList, TitleBlock, uiTheme } from "../../src/ui/modern";

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
    <ModernScreen scroll bottomAccessory={<GuardBottomNav />}>
      <FadeInCard delay={0} style={{ gap: 14 }}>
        <Pill text="HISTORIAL" />
        <TitleBlock title="Registros de acceso" subtitle="Filtra por documento, nombre o serial sin salir del flujo operativo." />
      </FadeInCard>

      <FadeInCard delay={70} style={{ gap: 12 }}>
        <InputField value={q} onChangeText={setQ} label="Buscar" placeholder="Documento, nombre o serial" />
        <ModernButton label={loading ? "Buscando..." : "Filtrar"} onPress={buscar} disabled={loading} />
      </FadeInCard>

      <FadeInCard delay={120} style={{ gap: 12 }}>
        {loading ? (
          <SkeletonList items={3} />
        ) : (
          <FlatList
            data={grouped}
            scrollEnabled={false}
            keyExtractor={(i) => i.dia}
            renderItem={({ item }) => (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontWeight: "900", color: uiTheme.ink, marginBottom: 8, fontSize: 16 }}>{item.dia}</Text>
                {item.items.map((r) => {
                  const accent = r.tipo === "ingreso" ? uiTheme.success : uiTheme.warn;
                  return (
                    <View
                      key={r.id}
                      style={{
                        backgroundColor: "rgba(255,255,255,0.78)",
                        borderWidth: 1,
                        borderColor: "rgba(148,163,184,0.22)",
                        borderRadius: 18,
                        padding: 12,
                        marginBottom: 8,
                        gap: 6,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ fontWeight: "900", color: uiTheme.ink }}>#{r.id}</Text>
                        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: `${accent}18`, borderWidth: 1, borderColor: `${accent}24` }}>
                          <Text style={{ color: accent, fontWeight: "900", fontSize: 11 }}>{r.tipo.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={{ color: uiTheme.inkSoft }}>{new Date(r.fecha).toLocaleString()}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            ListEmptyComponent={
              <EmptyState
                icon="search-outline"
                title="Sin resultados"
                subtitle="Ajusta el criterio de búsqueda para encontrar ingresos, salidas o validaciones de equipos."
              />
            }
          />
        )}
      </FadeInCard>
    </ModernScreen>
  );
}
