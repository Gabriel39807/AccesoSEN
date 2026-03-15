import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { api } from "../../src/api/client";
import { EmptyState, FadeInCard, ModernButton, ModernScreen, Pill, SkeletonList, uiTheme } from "../../src/ui/modern";

type AccesoItem = {
  id: number;
  tipo: "ingreso" | "salida";
  fecha: string;
  sede?: string;
};

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString();
}

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
    void cargar();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, AccesoItem[]>();
    for (const row of rows) {
      const key = dayKey(row.fecha);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return Array.from(map.entries()).map(([day, items]) => ({ day, items }));
  }, [rows]);

  return (
    <ModernScreen scroll>
      <FadeInCard delay={0} style={{ gap: 16 }}>
        <Pill text="HISTORIAL" />
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
                Trazabilidad personal
              </Text>
              <Text style={{ color: "#ffffff", fontSize: 28, lineHeight: 32, fontWeight: "900", letterSpacing: -0.8 }}>
                Tus movimientos de acceso
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.76)", lineHeight: 20 }}>
                Revisa entradas y salidas registradas, con fecha, hora y sede en una vista mucho mas clara.
              </Text>
            </View>
            <View style={{ width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
              <Ionicons name="time-outline" size={24} color="#ffffff" />
            </View>
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={70} style={{ gap: 12 }}>
        <ModernButton label={loading ? "Actualizando..." : "Actualizar"} tone="light" onPress={cargar} disabled={loading} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: "rgba(148,163,184,0.22)" }}>
            <Text style={{ color: uiTheme.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>Registros</Text>
            <Text style={{ color: uiTheme.ink, fontSize: 22, fontWeight: "900", marginTop: 6 }}>{rows.length}</Text>
          </View>
          <View style={{ flex: 1, borderRadius: 18, padding: 12, backgroundColor: "rgba(15,118,110,0.08)", borderWidth: 1, borderColor: "rgba(15,118,110,0.16)" }}>
            <Text style={{ color: uiTheme.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>Ultimo estado</Text>
            <Text style={{ color: uiTheme.accentDeep, fontSize: 16, fontWeight: "900", marginTop: 8 }}>{rows[0]?.tipo?.toUpperCase() || "SIN DATOS"}</Text>
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={120} style={{ gap: 12 }}>
        {loading ? (
          <SkeletonList items={3} />
        ) : (
          <FlatList
            data={grouped}
            scrollEnabled={false}
            keyExtractor={(item) => item.day}
            renderItem={({ item }) => (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontWeight: "900", color: uiTheme.ink, marginBottom: 8, fontSize: 16 }}>{item.day}</Text>
                {item.items.map((entry) => {
                  const accent = entry.tipo === "ingreso" ? uiTheme.success : uiTheme.warn;
                  return (
                    <View
                      key={entry.id}
                      style={{
                        backgroundColor: "rgba(255,255,255,0.78)",
                        borderWidth: 1,
                        borderColor: "rgba(148,163,184,0.22)",
                        borderRadius: 20,
                        padding: 14,
                        marginBottom: 10,
                        gap: 6,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ fontWeight: "900", color: uiTheme.ink }}>#{entry.id}</Text>
                        <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: `${accent}18`, borderWidth: 1, borderColor: `${accent}26` }}>
                          <Text style={{ color: accent, fontWeight: "900", fontSize: 11, letterSpacing: 0.8 }}>{entry.tipo.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={{ color: uiTheme.inkSoft }}>{new Date(entry.fecha).toLocaleString()}</Text>
                      <Text style={{ color: uiTheme.muted }}>Sede: {entry.sede || "-"}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            ListEmptyComponent={
              <EmptyState
                icon="time-outline"
                title="Aun no hay movimientos"
                subtitle="Cuando registres tu primera entrada o salida, aparecera aqui con fecha, sede y hora."
              />
            }
          />
        )}
      </FadeInCard>
    </ModernScreen>
  );
}
