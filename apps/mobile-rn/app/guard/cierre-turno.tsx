import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, View, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import * as Turnos from "../../src/api/turnos";
import { useSessionStore } from "../../src/store/session";
import { FadeInCard, ModernButton, ModernScreen } from "../../src/ui/modern";

export default function CierreTurno() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id);

  const finalizarTurno = useSessionStore((s) => s.finalizarTurno);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<null | { turno: Turnos.Turno; resumen: { ingresos: number; salidas: number; total: number } }>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await Turnos.resumenTurno(id);
      if (!r.permitido) throw new Error(r.motivo || "No permitido");
      setData({ turno: r.turno, resumen: r.resumen });
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  async function confirmarCierre() {
    Alert.alert(
      "Confirmar Cierre de Turno",
      "¿Estás seguro que deseas finalizar este turno de forma definitiva? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Finalizar Turno",
          style: "destructive",
          onPress: async () => {
            await finalizarTurno();
            router.replace("/guard/turno-finalizado" as any);
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <ModernScreen theme="guard" contentStyle={{ justifyContent: "center" }}>
        <ActivityIndicator color="#1e3a8a" size="large" />
      </ModernScreen>
    );
  }

  if (!data) {
    return (
      <ModernScreen theme="guard" contentStyle={{ justifyContent: "center" }}>
        <FadeInCard intensity={90} style={{ padding: 24, alignItems: "center" }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(239, 68, 68, 0.15)", justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
            <Ionicons name="warning-outline" size={32} color="#ef4444" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "900", color: "#0f172a", marginBottom: 8 }}>Error de Carga</Text>
          <Text style={{ textAlign: "center", color: "#64748b", marginBottom: 20, lineHeight: 22 }}>
            No pudimos obtener el resumen del turno. Reintenta o contacta a soporte.
          </Text>
          <View style={{ width: "100%", gap: 12 }}>
            <ModernButton label="Reintentar" tone="dark" onPress={load} />
            <ModernButton label="Volver" tone="light" onPress={() => router.back()} />
          </View>
        </FadeInCard>
      </ModernScreen>
    );
  }

  return (
    <ModernScreen scroll theme="guard">
      
      {/* Floating Sapphire Header Card */}
      <FadeInCard delay={0} intensity={100} style={styles.headerCard}>
        <LinearGradient
          colors={["rgba(30, 58, 138, 0.95)", "rgba(23, 37, 84, 0.95)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerContent}>
          <View>
            <View style={[styles.badgeRow, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={[styles.badgeText, { color: "#ef4444" }]}>CIERRE DE TURNO</Text>
            </View>
            <Text style={styles.headerTitle}>Resumen Operativo</Text>
            <Text style={styles.headerSubtitle}>
              Sede {data.turno.sede} • {data.turno.jornada}
            </Text>
          </View>
        </View>
      </FadeInCard>

      {/* Operative Timeline */}
      <FadeInCard delay={70} intensity={80} style={{ padding: 20, marginTop: 12 }}>
        <Text style={styles.sectionTitle}>Periodo Operativo</Text>
        <View style={styles.timelineRow}>
          <View style={styles.timelinePoint}>
            <Ionicons name="play-circle" size={20} color="#0ea5e9" />
            <Text style={styles.timelineText}>
              <Text style={{ fontWeight: "700" }}>Inicio:</Text> {new Date(data.turno.inicio).toLocaleString()}
            </Text>
          </View>
          {data.turno.fin && (
            <View style={styles.timelinePoint}>
              <Ionicons name="stop-circle" size={20} color="#f59e0b" />
              <Text style={styles.timelineText}>
                <Text style={{ fontWeight: "700" }}>Fin:</Text> {new Date(data.turno.fin).toLocaleString()}
              </Text>
            </View>
          )}
        </View>
      </FadeInCard>

      {/* Final Stats */}
      <FadeInCard delay={120} intensity={80} style={{ padding: 20, marginTop: 12 }}>
        <Text style={styles.sectionTitle}>Balance Final</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <View style={[styles.statIconWrapper, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <Ionicons name="enter-outline" size={24} color="#10b981" />
            </View>
            <Text style={styles.statValue}>{data.resumen.ingresos}</Text>
            <Text style={styles.statLabel}>Ingresos</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statBox}>
            <View style={[styles.statIconWrapper, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
              <Ionicons name="exit-outline" size={24} color="#f59e0b" />
            </View>
            <Text style={styles.statValue}>{data.resumen.salidas}</Text>
            <Text style={styles.statLabel}>Salidas</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <View style={[styles.statIconWrapper, { backgroundColor: "rgba(15, 23, 42, 0.1)" }]}>
              <Ionicons name="people-outline" size={24} color="#0f172a" />
            </View>
            <Text style={[styles.statValue, { color: "#0f172a" }]}>{data.resumen.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      </FadeInCard>

      {/* Action Zone */}
      <FadeInCard delay={180} intensity={60} style={{ padding: 20, marginTop: 12, marginBottom: 40 }}>
        <Text style={styles.sectionTitle}>Acciones Finales</Text>
        <View style={{ gap: 12 }}>
          <ModernButton icon="checkmark-done" label="Confirmar Cierre Definitivo" tone="danger" onPress={confirmarCierre} />
          <ModernButton icon="arrow-back" label="Volver al Panel" tone="light" onPress={() => router.back()} />
        </View>
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  badgeText: {
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timelineRow: {
    gap: 12,
  },
  timelinePoint: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    padding: 12,
    borderRadius: 12,
  },
  timelineText: {
    fontSize: 14,
    color: "#334155",
    marginLeft: 10,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
  },
});
