import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import * as Notifs from "../../src/api/notificaciones";
import GuardBottomDock from "../../src/components/guard/GuardBottomDock";
import { guardHomeThemes, GuardThemeMode } from "../../src/components/guard/GuardHomeSections";
import { useResolvedThemeMode } from "../../src/store/preferences";
import { ModernButton, ModernScreen } from "../../src/ui/modern";

type EstadoAlerta = "nueva" | "pendiente" | "leida";

export default function GuardAlertas() {
  const mode = useResolvedThemeMode() as GuardThemeMode;
  const theme = guardHomeThemes[mode];

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Notifs.Notificacion[]>([]);

  async function load() {
    setLoading(true);
    try {
      const data = await Notifs.listar();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const metrics = useMemo(() => {
    const nuevas = safeItems.filter((item) => !item.read_at).length;
    const pendientes = safeItems.filter((item) => item.tipo === "URGENT" || item.tipo === "WARNING").length;
    const leidas = safeItems.filter((item) => Boolean(item.read_at)).length;
    return { nuevas, pendientes, leidas };
  }, [safeItems]);

  return (
    <View style={styles.root}>
      <ModernScreen scroll theme="guard" contentStyle={{ paddingBottom: 154 }}>
        <View style={styles.headerBlock}>
          <Text style={[styles.screenTitle, { color: theme.text }]}>Alertas</Text>
          <Text style={[styles.screenSubtitle, { color: theme.textSoft }]}>
            Revisa novedades operativas, sincroniza avisos y marca eventos atendidos desde un mismo panel.
          </Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: theme.sectionBg, borderColor: theme.summaryBorder }]}>
          <MetricCard label="Nuevas" value={metrics.nuevas} icon="sparkles-outline" theme={theme} />
          <MetricCard label="Pendientes" value={metrics.pendientes} icon="alert-circle-outline" theme={theme} />
          <MetricCard label="Leídas" value={metrics.leidas} icon="checkmark-done-outline" theme={theme} highlight />
        </View>

        <View style={[styles.actionCard, { backgroundColor: theme.sectionBg, borderColor: theme.summaryBorder }]}>
          <Text style={[styles.actionTitle, { color: theme.text }]}>Sincronización</Text>
          <Text style={[styles.actionBody, { color: theme.textSoft }]}>
            Actualiza el tablero para consultar el estado más reciente de las alertas operativas.
          </Text>
          <View style={{ marginTop: 16 }}>
            <ModernButton icon="refresh-outline" label={loading ? "Sincronizando alertas..." : "Sincronizar alertas"} tone="guard" onPress={load} disabled={loading} />
          </View>
        </View>

        <View style={[styles.listCard, { backgroundColor: theme.sectionBg, borderColor: theme.summaryBorder }]}>
          <View style={styles.listHeader}>
            <Text style={[styles.listTitle, { color: theme.text }]}>Listado de alertas</Text>
            <Text style={[styles.listCount, { color: theme.textSoft }]}>{safeItems.length} elementos</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={theme.accentStrong} size="large" style={{ marginVertical: 48 }} />
          ) : (
            <FlatList
              data={safeItems}
              scrollEnabled={false}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={safeItems.length === 0 ? { paddingVertical: 24 } : { gap: 10 }}
              renderItem={({ item }) => <AlertRow item={item} theme={theme} onRefresh={load} />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="notifications-off-outline" size={44} color={theme.textSoft} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>No hay alertas pendientes</Text>
                  <Text style={[styles.emptyBody, { color: theme.textSoft }]}>Todo está al día por ahora. Sincroniza más tarde para revisar nuevas novedades.</Text>
                </View>
              }
            />
          )}
        </View>
      </ModernScreen>

      <GuardBottomDock active="alertas" mode={mode} />
    </View>
  );
}

function MetricCard({
  label,
  value,
  icon,
  theme,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  theme: typeof guardHomeThemes.light;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.metricBox, { backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.46)", borderColor: theme.divider }]}>
      <Ionicons name={icon} size={18} color={highlight ? theme.accentStrong : theme.accent} />
      <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: theme.textSoft }]}>{label}</Text>
    </View>
  );
}

function AlertRow({
  item,
  theme,
  onRefresh,
}: {
  item: Notifs.Notificacion;
  theme: typeof guardHomeThemes.light;
  onRefresh: () => Promise<void>;
}) {
  const read = Boolean(item.read_at);
  const state: EstadoAlerta = read ? "leida" : item.tipo === "URGENT" ? "pendiente" : "nueva";
  const tone = item.tipo === "URGENT" ? "#ef4444" : item.tipo === "WARNING" ? "#f59e0b" : "#0ea5e9";
  const toneBg = item.tipo === "URGENT" ? "rgba(239,68,68,0.12)" : item.tipo === "WARNING" ? "rgba(245,158,11,0.12)" : "rgba(14,165,233,0.12)";

  return (
    <View style={[styles.rowCard, { backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.58)", borderColor: theme.divider }]}>
      <View style={styles.rowTop}>
        <View style={[styles.rowTypeBadge, { backgroundColor: toneBg }]}>
          <Text style={[styles.rowTypeText, { color: tone }]}>{item.tipo}</Text>
        </View>
        <Text style={[styles.rowDate, { color: theme.textSoft }]}>{new Date(item.created_at).toLocaleString()}</Text>
      </View>

      <Text style={[styles.rowTitle, { color: theme.text }]}>{item.titulo}</Text>
      <Text style={[styles.rowBody, { color: theme.textMuted }]}>{item.mensaje}</Text>

      <View style={styles.rowFooter}>
        <View style={[styles.statusPill, { backgroundColor: read ? "rgba(16,185,129,0.12)" : toneBg }]}>
          <Ionicons name={read ? "checkmark-done-outline" : "alert-circle-outline"} size={14} color={read ? "#10b981" : tone} />
          <Text style={[styles.statusText, { color: read ? "#10b981" : tone }]}>{labelForState(state)}</Text>
        </View>

        {!read ? (
          <View style={styles.rowAction}>
            <ModernButton
              icon="checkmark-circle-outline"
              label="Marcar leída"
              tone="light"
              onPress={async () => {
                await Notifs.marcarLeida(item.id);
                await onRefresh();
              }}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function labelForState(state: EstadoAlerta) {
  switch (state) {
    case "nueva":
      return "Nueva";
    case "pendiente":
      return "Pendiente";
    case "leida":
      return "Leída";
    default:
      return "Nueva";
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBlock: {
    gap: 6,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  screenSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  summaryCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    gap: 10,
  },
  metricBox: {
    flex: 1,
    minHeight: 96,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "900",
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  actionCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
  },
  actionTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  actionBody: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  listCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    marginBottom: 24,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  listCount: {
    fontSize: 13,
    fontWeight: "700",
  },
  rowCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowTypeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rowTypeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  rowDate: {
    fontSize: 12,
    fontWeight: "600",
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  rowBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  rowFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  rowAction: {
    minWidth: 150,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 36,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
  },
});
