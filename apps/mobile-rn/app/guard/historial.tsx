import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { api } from "../../src/api/client";
import { FadeInCard, InputField, ModernButton, ModernScreen } from "../../src/ui/modern";

type Row = { id: number; tipo: "ingreso" | "salida"; fecha: string; aprendiz_nombre?: string };

function dayKey(iso: string) {
  const d = new Date(iso);
  const today = new Date().toLocaleDateString();
  const dateStr = d.toLocaleDateString();
  if (dateStr === today) return "Hoy";
  return dateStr;
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
    <ModernScreen scroll theme="guard">
      
      {/* Floating Sapphire Header Card */}
      <FadeInCard delay={0} intensity={100} style={styles.headerCard}>
        <LinearGradient
          colors={["rgba(30, 58, 138, 0.95)", "rgba(23, 37, 84, 0.95)"]} // Deep Navy/Cobalt
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerContent}>
          <View>
            <View style={styles.badgeRow}>
              <Ionicons name="list-outline" size={16} color="#38bdf8" />
              <Text style={styles.badgeText}>REGISTROS GLOBALES</Text>
            </View>
            <Text style={styles.headerTitle}>Historial</Text>
            <Text style={styles.headerSubtitle}>Consulta los movimientos del turno actual y anteriores.</Text>
          </View>
          <ModernButton 
            icon="arrow-back" 
            label="" 
            tone="light" 
            onPress={() => router.back()} 
          />
        </View>
      </FadeInCard>

      {/* Search Bar Container */}
      <FadeInCard delay={70} intensity={80} style={{ padding: 20, marginTop: 12 }}>
        <InputField 
          icon="search-outline"
          value={q} 
          onChangeText={setQ} 
          label="Búsqueda Integrada" 
          placeholder="Ej. ID, Documento o Nombre" 
        />
        <View style={{ marginTop: 16 }}>
          <ModernButton 
            icon="filter" 
            label={loading ? "Buscando información..." : "Aplicar Filtro"} 
            tone="primary" 
            onPress={buscar} 
            disabled={loading} 
          />
        </View>
      </FadeInCard>

      {/* History List */}
      <FadeInCard delay={120} intensity={60} style={{ padding: 20, marginTop: 12, marginBottom: 40, minHeight: 300 }}>
        {loading ? (
          <ActivityIndicator color="#1e3a8a" size="large" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={grouped}
            scrollEnabled={false}
            keyExtractor={(i) => i.dia}
            renderItem={({ item }) => (
              <View style={{ marginBottom: 24 }}>
                <View style={styles.dayGroupHeader}>
                  <Text style={styles.dayGroupTitle}>{item.dia}</Text>
                  <View style={styles.dayGroupLine} />
                </View>

                {item.items.map((r) => {
                  const isIngreso = r.tipo.toLowerCase() === "ingreso";
                  return (
                    <View
                      key={r.id}
                      style={[
                        styles.recordCard,
                        { borderLeftColor: isIngreso ? "#10b981" : "#f59e0b" }
                      ]}
                    >
                      <View style={styles.recordIconBox}>
                        <Ionicons 
                          name={isIngreso ? "log-in" : "log-out"} 
                          size={20} 
                          color={isIngreso ? "#10b981" : "#f59e0b"} 
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recordType}>
                          {r.tipo.toUpperCase()}
                        </Text>
                        <Text style={styles.recordDate}>
                          {new Date(r.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {r.aprendiz_nombre ? ` • ${r.aprendiz_nombre}` : ''}
                        </Text>
                      </View>
                      <View style={styles.recordIdBadge}>
                        <Text style={styles.recordIdText}>#{r.id}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="folder-open-outline" size={48} color="#94a3b8" />
                <Text style={styles.emptyStateText}>No se encontraron registros</Text>
                <Text style={styles.emptyStateSubtext}>Busca un documento para ver su historial.</Text>
              </View>
            }
          />
        )}
      </FadeInCard>
    </ModernScreen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    padding: 24,
    overflow: "hidden",
    borderWidth: 0,
    shadowColor: "#0f172a",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  badgeText: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#bae6fd",
    marginTop: 4,
    fontWeight: "500",
  },
  dayGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dayGroupTitle: {
    fontWeight: "900",
    color: "#0f172a",
    fontSize: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginRight: 16,
  },
  dayGroupLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(15, 23, 42, 0.1)",
  },
  recordCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  recordIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(15, 23, 42, 0.03)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  recordType: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  recordDate: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
    marginTop: 2,
  },
  recordIdBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  recordIdText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94a3b8",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    color: "#0f172a",
    fontWeight: "800",
    marginTop: 16,
    fontSize: 16,
  },
  emptyStateSubtext: {
    color: "#64748b",
    fontWeight: "500",
    marginTop: 4,
    fontSize: 14,
    textAlign: "center"
  }
});
