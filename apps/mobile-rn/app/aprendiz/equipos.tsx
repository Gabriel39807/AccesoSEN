import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { api, toUiErrorMessage } from "../../src/api/client";
import AprendizBottomDock from "../../src/components/aprendiz/AprendizBottomDock";
import { FadeInCard, InputField, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

type EquipoItem = {
  id: number;
  serial: string;
  marca: string;
  modelo: string;
  estado: string;
  motivo_rechazo?: string | null;
};

export default function AprendizEquipos() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [items, setItems] = useState<EquipoItem[]>([]);

  const [serial, setSerial] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");

  async function cargar() {
    setLoading(true);
    try {
      const r = await api.get<EquipoItem[] | { results: EquipoItem[] }>("/api/equipos/");
      const data = Array.isArray(r.data) ? r.data : r.data?.results ?? [];
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function crear() {
    setMsg(null);
    if (!serial.trim() || !marca.trim() || !modelo.trim()) {
      setMsg("Serial, marca y modelo son obligatorios.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/api/equipos/", {
        serial: serial.trim(),
        marca: marca.trim(),
        modelo: modelo.trim(),
      });
      setSerial("");
      setMarca("");
      setModelo("");
      setMsg("Equipo registrado correctamente.");
      await cargar();
    } catch (e: any) {
      setMsg(toUiErrorMessage(e, "No se pudo registrar el equipo."));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <View style={styles.root}>
      <ModernScreen scroll theme="aprendiz" contentStyle={{ paddingBottom: 154 }}>
        <FadeInCard>
          <Pill text="EQUIPOS" icon="cube-outline" tone="aprendiz" />
          <View style={{ marginTop: 8 }}>
            <TitleBlock title="Tus equipos" subtitle="Consulta el estado de tus equipos y registra nuevos dispositivos desde este módulo principal." />
          </View>
        </FadeInCard>

        <FadeInCard delay={70}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Resumen</Text>
            <Text style={styles.sectionCount}>{items.length} registrados</Text>
          </View>
          <View style={styles.summaryCards}>
            <MetricCard icon="cube-outline" label="Total" value={items.length} />
            <MetricCard icon="checkmark-done-outline" label="Activos" value={items.filter((item) => item.estado?.toUpperCase() === "APROBADO").length} />
            <MetricCard icon="alert-circle-outline" label="Pendientes" value={items.filter((item) => item.estado?.toUpperCase() !== "APROBADO").length} />
          </View>
        </FadeInCard>

        <FadeInCard delay={120}>
          <TitleBlock title="Registrar equipo" subtitle="Agrega serial, marca y modelo para solicitar validación." />
          <View style={styles.formStack}>
            <InputField label="Serial" value={serial} onChangeText={setSerial} placeholder="ABC1234" icon="barcode-outline" />
            <InputField label="Marca" value={marca} onChangeText={setMarca} placeholder="Dell" icon="hardware-chip-outline" />
            <InputField label="Modelo" value={modelo} onChangeText={setModelo} placeholder="Inspiron 15" icon="laptop-outline" />
            <ModernButton label={saving ? "Guardando..." : "Registrar equipo"} tone="aprendiz" disabled={saving} onPress={crear} />
            {msg ? <Text style={{ color: msg.toLowerCase().includes("correctamente") ? "#15803d" : "#b91c1c" }}>{msg}</Text> : null}
          </View>
        </FadeInCard>

        <FadeInCard delay={170} style={{ marginBottom: 24 }}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Listado</Text>
            <ModernButton label={loading ? "Actualizando..." : "Actualizar"} tone="light" onPress={cargar} disabled={loading} />
          </View>
          <View style={{ marginTop: 14 }}>
            {loading ? (
              <ActivityIndicator />
            ) : (
              <FlatList
                data={items}
                scrollEnabled={false}
                keyExtractor={(i) => String(i.id)}
                contentContainerStyle={items.length === 0 ? { paddingVertical: 10 } : { gap: 10 }}
                renderItem={({ item }) => (
                  <View style={styles.listRow}>
                    <View style={styles.listIconWrap}>
                      <Ionicons name="cube-outline" size={18} color="#0b89d1" />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.listTitle}>
                        {item.marca} {item.modelo}
                      </Text>
                      <Text style={styles.listMeta}>Serial: {item.serial}</Text>
                      <Text style={styles.listMeta}>Estado: {item.estado}</Text>
                      {item.motivo_rechazo ? <Text style={styles.listDanger}>Motivo: {item.motivo_rechazo}</Text> : null}
                    </View>
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>Aun no tienes equipos registrados.</Text>}
              />
            )}
          </View>
        </FadeInCard>
      </ModernScreen>

      <AprendizBottomDock active="inicio" />
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.metricCard}>
      <Ionicons name={icon} size={18} color="#0b89d1" />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#14253d",
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6888a9",
  },
  summaryCards: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(14,165,233,0.14)",
    backgroundColor: "rgba(255,255,255,0.52)",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#14253d",
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b88a8",
  },
  formStack: {
    marginTop: 14,
    gap: 10,
  },
  listRow: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(14,165,233,0.14)",
    backgroundColor: "rgba(255,255,255,0.52)",
    padding: 14,
  },
  listIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(14,165,233,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f223f",
  },
  listMeta: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5c7895",
  },
  listDanger: {
    fontSize: 13,
    fontWeight: "700",
    color: "#b91c1c",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "600",
  },
});
