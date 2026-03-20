import React, { useEffect, useState, useRef } from "react";
import { ActivityIndicator, Alert, FlatList, Text, View, Animated, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useSessionStore } from "../../src/store/session";
import { api } from "../../src/api/client";
import * as Accesos from "../../src/api/accesos";
import { FadeInCard, ModernButton, ModernScreen } from "../../src/ui/modern";

type AccesoRow = { id: number; tipo: "ingreso" | "salida"; fecha: string; aprendiz_nombre?: string };

function AnimatedListItem({ item, index }: { item: AccesoRow, index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay: index * 80, // Smooth staggered entrance
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index]);

  const isIngreso = item.tipo.toLowerCase() === "ingreso";

  return (
    <Animated.View
      style={[
        styles.recordCard,
        {
          opacity,
          transform: [{ translateX }],
          borderLeftColor: isIngreso ? "#10b981" : "#f59e0b",
        }
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
          {item.tipo.toUpperCase()}
        </Text>
        <Text style={styles.recordDate}>
          {new Date(item.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(item.fecha).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.recordIdBadge}>
        <Text style={styles.recordIdText}>#{item.id}</Text>
      </View>
    </Animated.View>
  );
}

export default function GuardHome() {
  const user = useSessionStore((s) => s.user);
  const turno = useSessionStore((s) => s.turno);
  const signOut = useSessionStore((s) => s.signOut);

  const [loading, setLoading] = useState(true);
  const [recientes, setRecientes] = useState<AccesoRow[]>([]);
  const [stats, setStats] = useState<{ ingresos: number; salidas: number; total: number } | null>(null);

  async function cargarRecientes() {
    setLoading(true);
    try {
      const r = await api.get("/api/accesos/?page=1");
      const results = r.data?.results ?? [];
      setRecientes(results.slice(0, 5)); // Keep UI clean
    } catch {
      setRecientes([]);
    } finally {
      setLoading(false);
    }
  }

  async function cargarStats() {
    try {
      const r = await Accesos.stats();
      if (r?.permitido && r.stats) setStats(r.stats);
      else setStats(null);
    } catch {
      setStats(null);
    }
  }

  useEffect(() => {
    cargarRecientes();
    cargarStats();
  }, []);

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
              <Ionicons name="shield-checkmark" size={16} color="#38bdf8" />
              <Text style={styles.badgeText}>GUARDA ACTIVO</Text>
            </View>
            <Text style={styles.headerTitle}>
              Hola, {user?.first_name || user?.username || "Guarda"}
            </Text>
            <Text style={styles.headerSubtitle}>
              Sede {turno?.sede ?? "-"} • Turno {turno?.jornada ?? "-"}
            </Text>
          </View>
          <View style={styles.avatarCircle}>
             <Ionicons name="person" size={24} color="#1e3a8a" />
          </View>
        </View>
      </FadeInCard>

      {/* Stats Dashboard */}
      <FadeInCard delay={100} intensity={80} style={{ padding: 20 }}>
        <Text style={styles.sectionTitle}>Resumen de Hoy</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <View style={[styles.statIconWrapper, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <Ionicons name="enter-outline" size={24} color="#10b981" />
            </View>
            <Text style={styles.statValue}>{stats?.ingresos ?? "-"}</Text>
            <Text style={styles.statLabel}>Ingresos</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statBox}>
            <View style={[styles.statIconWrapper, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
              <Ionicons name="exit-outline" size={24} color="#f59e0b" />
            </View>
            <Text style={styles.statValue}>{stats?.salidas ?? "-"}</Text>
            <Text style={styles.statLabel}>Salidas</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <View style={[styles.statIconWrapper, { backgroundColor: "rgba(15, 23, 42, 0.1)" }]}>
              <Ionicons name="people-outline" size={24} color="#0f172a" />
            </View>
            <Text style={[styles.statValue, { color: "#0f172a" }]}>{stats?.total ?? "-"}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      </FadeInCard>

      {/* Master Action Grid */}
      <FadeInCard delay={200} intensity={80} style={{ padding: 20 }}>
        <Text style={styles.sectionTitle}>Operaciones</Text>
        <View style={{ gap: 12 }}>
          {/* Main Hero Action */}
          <Pressable 
            onPress={() => router.push("/guard/scan" as any)}
            style={({ pressed }) => [styles.heroActionBtn, pressed && { opacity: 0.85 }]}
          >
            <LinearGradient
              colors={["#0ea5e9", "#0284c7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="barcode-outline" size={32} color="#ffffff" />
            <View style={{ marginLeft: 16 }}>
              <Text style={styles.heroActionTitle}>Escanear Código</Text>
              <Text style={styles.heroActionSubtitle}>Registrar ingreso o salida</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" style={{ marginLeft: "auto" }} />
          </Pressable>

          {/* Secondary Actions Row */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <ModernButton icon="list-outline" label="Historial" tone="light" onPress={() => router.push("/guard/historial" as any)} />
            </View>
            <View style={{ flex: 1 }}>
              <ModernButton icon="warning-outline" label="Alertas" tone="light" onPress={() => router.push("/guard/alertas" as any)} />
            </View>
          </View>

          {/* Destructive Actions */}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <ModernButton
                icon="log-out-outline"
                label="Salir"
                tone="dark"
                onPress={async () => {
                  await signOut();
                  router.replace("/" as any);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ModernButton
                icon="calendar-outline"
                label="Cerrar Turno"
                tone="danger"
                onPress={() => {
                  if (!turno?.id) {
                    Alert.alert("Sin turno", "No hay turno activo para cerrar.");
                    return;
                  }
                  router.push({ pathname: "/guard/cierre-turno", params: { id: String(turno.id) } } as any);
                }}
              />
            </View>
          </View>
        </View>
      </FadeInCard>

      {/* Recents Feed */}
      <FadeInCard delay={300} intensity={60} style={{ padding: 20, marginBottom: 40 }}>
        <View style={styles.feedHeader}>
          <Text style={styles.sectionTitle}>Últimos Registros</Text>
          <Pressable onPress={cargarRecientes}>
            <Ionicons name="refresh" size={20} color="#0ea5e9" />
          </Pressable>
        </View>
        
        {loading ? (
          <ActivityIndicator color="#1e3a8a" size="large" style={{ marginVertical: 20 }} />
        ) : (
          <FlatList
            data={recientes}
            scrollEnabled={false}
            keyExtractor={(i) => String(i.id)}
            renderItem={({ item, index }) => <AnimatedListItem item={item} index={index} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="file-tray-outline" size={32} color="#94a3b8" />
                <Text style={styles.emptyStateText}>No hay registros recientes</Text>
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
    alignItems: "center",
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
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e0f2fe",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  heroActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  heroActionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  heroActionSubtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  feedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    paddingVertical: 30,
  },
  emptyStateText: {
    color: "#94a3b8",
    fontWeight: "600",
    marginTop: 12,
    fontSize: 14,
  }
});
