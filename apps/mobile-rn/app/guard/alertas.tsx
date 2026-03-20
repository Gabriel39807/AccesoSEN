import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import * as Notifs from "../../src/api/notificaciones";
import { FadeInCard, ModernButton, ModernScreen } from "../../src/ui/modern";

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
              <Ionicons name="warning-outline" size={16} color="#38bdf8" />
              <Text style={styles.badgeText}>CENTRO DE ALERTAS</Text>
            </View>
            <Text style={styles.headerTitle}>Novedades</Text>
            <Text style={styles.headerSubtitle}>Revisa y marca como leídas las alertas operativas.</Text>
          </View>
          <ModernButton 
            icon="arrow-back" 
            label="" 
            tone="light" 
            onPress={() => router.back()} 
          />
        </View>
      </FadeInCard>

      <FadeInCard delay={70} intensity={80} style={{ padding: 20, marginTop: 12 }}>
        <ModernButton 
          icon="refresh" 
          label={loading ? "Sincronizando..." : "Sincronizar Alertas"} 
          tone="light" 
          onPress={load} 
          disabled={loading} 
        />
      </FadeInCard>

      <FadeInCard delay={120} intensity={60} style={{ padding: 20, marginTop: 12, marginBottom: 40, minHeight: 300 }}>
        {loading ? (
          <ActivityIndicator color="#1e3a8a" size="large" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={items}
            scrollEnabled={false}
            keyExtractor={(i) => String(i.id)}
            renderItem={({ item }) => {
              const color = item.tipo === "URGENT" ? "#b91c1c" : item.tipo === "WARNING" ? "#b45309" : "#0f766e";
              const bgColor = item.tipo === "URGENT" ? "rgba(239, 68, 68, 0.1)" : item.tipo === "WARNING" ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)";
              
              return (
                <View
                  style={[
                    styles.alertCard,
                    { borderLeftColor: color }
                  ]}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.alertTitle}>{item.titulo}</Text>
                      <Text style={styles.alertDate}>{new Date(item.created_at).toLocaleString()}</Text>
                    </View>
                    <View style={[styles.typeBadge, { backgroundColor: bgColor }]}>
                      <Text style={[styles.typeBadgeText, { color }]}>{item.tipo}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.alertMessage}>{item.mensaje}</Text>
                  
                  <View style={{ marginTop: 16 }}>
                    <ModernButton
                      icon={item.read_at ? "checkmark-done" : "checkmark-circle-outline"}
                      label={item.read_at ? "Leida" : "Marcar como leída"}
                      tone={item.read_at ? "light" : "dark"}
                      onPress={async () => {
                        if (!item.read_at) await Notifs.marcarLeida(item.id);
                        load();
                      }}
                    />
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-done-circle-outline" size={48} color="#10b981" />
                <Text style={styles.emptyStateText}>Todo en orden</Text>
                <Text style={styles.emptyStateSubtext}>No hay alertas operativas pendientes en este momento.</Text>
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
  alertCard: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  alertTitle: {
    fontWeight: "900",
    color: "#0f172a",
    fontSize: 16,
    letterSpacing: 0.2,
  },
  alertDate: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  typeBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  alertMessage: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 20,
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
