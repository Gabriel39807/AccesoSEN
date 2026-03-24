import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Turnos from "../../src/api/turnos";
import { useSessionStore } from "../../src/store/session";
import { ModernButton } from "../../src/ui/modern";
import { useResolvedThemeMode } from "../../src/store/preferences";
import { guardHomeThemes, GuardThemeMode } from "../../src/components/guard/GuardHomeSections";

export default function CierreTurno() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id);
  const insets = useSafeAreaInsets();
  const mode = useResolvedThemeMode() as GuardThemeMode;
  const theme = guardHomeThemes[mode];
  const isDark = mode === "dark";

  const finalizarTurno = useSessionStore((s) => s.finalizarTurno);

  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
    if (id) void load();
  }, [id, load]);

  const periodText = useMemo(() => {
    if (!data?.turno) return "--";
    const inicio = new Date(data.turno.inicio).toLocaleString();
    const fin = data.turno.fin ? new Date(data.turno.fin).toLocaleString() : "En curso";
    return `${inicio} · ${fin}`;
  }, [data]);

  async function confirmarCierre() {
    try {
      setFinalizing(true);
      await finalizarTurno();
      router.replace("/guard/turno-finalizado" as any);
    } finally {
      setFinalizing(false);
      setShowConfirm(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.centerState, { backgroundColor: theme.background[0] }]}>
        <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color={theme.accentStrong} size="large" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background[0] }]}>
        <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.errorWrap, { paddingTop: insets.top + 24, paddingBottom: 32 + Math.max(insets.bottom, 10) }]}>
          <View style={[styles.errorCard, { backgroundColor: theme.sectionBg, borderColor: theme.cardBorder, shadowColor: isDark ? theme.accentGlow : "rgba(120, 158, 224, 0.18)" }]}>
            <View style={[styles.errorIconWrap, { backgroundColor: isDark ? "rgba(255,139,129,0.14)" : "rgba(180,35,24,0.10)" }]}>
              <Ionicons name="warning-outline" size={30} color={theme.warning} />
            </View>
            <Text style={[styles.errorTitle, { color: theme.text }]}>No pudimos cargar el cierre de turno</Text>
            <Text style={[styles.errorText, { color: theme.textSoft }]}>
              Reintenta para consultar el resumen operativo antes de finalizar la jornada.
            </Text>
            <View style={styles.errorActions}>
              <ModernButton label="Reintentar" tone="guard" icon="refresh-outline" onPress={load} />
              <ModernButton label="Volver al panel" tone="light" icon="arrow-back" onPress={() => router.back()} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background[0] }]}>
      <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={isDark ? ["rgba(92,161,255,0.14)", "rgba(92,161,255,0.03)", "transparent"] : ["rgba(129,176,255,0.14)", "rgba(129,176,255,0.03)", "rgba(255,255,255,0.02)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.ambientTop}
      />
      <LinearGradient
        colors={isDark ? ["transparent", "rgba(29,107,201,0.08)", "transparent"] : ["transparent", "rgba(191,220,255,0.14)", "rgba(255,255,255,0.04)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ambientBeam}
      />
      <LinearGradient
        colors={isDark ? ["transparent", "rgba(74,146,239,0.06)", "rgba(74,146,239,0.01)"] : ["rgba(255,255,255,0.02)", "rgba(207,230,255,0.16)", "rgba(239,246,255,0.20)"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.ambientBottom}
      />
      <View style={[styles.content, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) + 24 }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.72 : 1, borderColor: theme.cardBorder, backgroundColor: theme.sectionBg }]}>
            <Ionicons name="arrow-back" size={18} color={theme.text} />
          </Pressable>
          <Text style={[styles.topLabel, { color: theme.textSoft }]}>Cierre de turno</Text>
          <View style={styles.topSpacer} />
        </View>

        <View style={[styles.heroCard, { backgroundColor: theme.sectionBg, borderColor: theme.cardBorder, shadowColor: isDark ? theme.accentGlow : "rgba(120, 158, 224, 0.18)" }]}>
          <View style={styles.heroHeader}>
            <View style={[styles.heroIconWrap, { backgroundColor: isDark ? "rgba(255,139,129,0.14)" : "rgba(180,35,24,0.10)" }]}>
              <Ionicons name="shield-checkmark-outline" size={30} color={theme.warning} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={[styles.heroTitle, { color: theme.text }]}>Resumen del turno</Text>
              <Text style={[styles.heroSubtitle, { color: theme.textSoft }]}>
                Revisa el balance final antes de finalizar la operacion.
              </Text>
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            <MetaBadge icon="business-outline" label={data.turno.sede} theme={theme} />
            <MetaBadge icon="time-outline" label={data.turno.jornada} theme={theme} />
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Periodo operativo</Text>
            <View style={styles.detailStack}>
              <DetailRow icon="play-circle-outline" label="Inicio" value={new Date(data.turno.inicio).toLocaleString()} theme={theme} />
              <DetailRow icon="stop-circle-outline" label="Fin" value={data.turno.fin ? new Date(data.turno.fin).toLocaleString() : "Se cerrara al confirmar"} theme={theme} />
              <DetailRow icon="calendar-outline" label="Periodo" value={periodText} theme={theme} />
            </View>
          </View>

          <View style={[styles.metricsCard, { backgroundColor: theme.sectionBg, borderColor: theme.summaryBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Balance final</Text>
            <View style={styles.metricsGrid}>
              <MetricCard icon="log-in-outline" label="Ingresos" value={data.resumen.ingresos} accent="#10b981" theme={theme} />
              <MetricCard icon="log-out-outline" label="Salidas" value={data.resumen.salidas} accent="#f59e0b" theme={theme} />
              <MetricCard icon="layers-outline" label="Total" value={data.resumen.total} accent={theme.accent} theme={theme} full />
            </View>
          </View>
        </ScrollView>

        <View style={styles.actionBlock}>
          <ModernButton
            icon="checkmark-done-outline"
            label={finalizing ? "Finalizando turno..." : "Cerrar turno"}
            tone="danger"
            disabled={finalizing}
            onPress={() => setShowConfirm(true)}
          />
          <ModernButton icon="arrow-back" label="Volver al panel" tone="light" disabled={finalizing} onPress={() => router.back()} />
        </View>
      </View>

      <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => !finalizing && setShowConfirm(false)}>
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={isDark ? 46 : 56}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(3, 8, 18, 0.76)" : "rgba(236, 242, 255, 0.84)" }]} />
          <View style={[styles.modalCard, { backgroundColor: theme.sectionBg, borderColor: theme.cardBorder }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: isDark ? "rgba(255,139,129,0.14)" : "rgba(180,35,24,0.10)" }]}>
              <Ionicons name="alert-circle-outline" size={28} color={theme.warning} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Confirmar cierre de turno</Text>
            <Text style={[styles.modalText, { color: theme.textSoft }]}>
              ¿Deseas finalizar este turno de forma definitiva? Esta accion no se puede deshacer.
            </Text>
            <View style={styles.modalActions}>
              <ModernButton label="Cancelar" tone="light" disabled={finalizing} onPress={() => setShowConfirm(false)} />
              <ModernButton
                label={finalizing ? "Finalizando..." : "Finalizar turno"}
                tone="danger"
                disabled={finalizing}
                onPress={() => {
                  void confirmarCierre();
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MetaBadge({
  icon,
  label,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  theme: (typeof guardHomeThemes)["light"];
}) {
  return (
    <View style={[styles.metaBadge, { backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.56)", borderColor: theme.summaryBorder }]}>
      <Ionicons name={icon} size={15} color={theme.accent} />
      <Text style={[styles.metaBadgeText, { color: theme.text }]}>{label}</Text>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  theme: (typeof guardHomeThemes)["light"];
}) {
  return (
    <View style={[styles.detailRow, { borderColor: theme.summaryBorder, backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.56)" }]}>
      <View style={[styles.detailIconWrap, { backgroundColor: theme.mode === "dark" ? "rgba(89,185,255,0.10)" : "rgba(45,104,216,0.08)" }]}>
        <Ionicons name={icon} size={16} color={theme.accent} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={[styles.detailLabel, { color: theme.textSoft }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
  accent,
  theme,
  full = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  accent: string;
  theme: (typeof guardHomeThemes)["light"];
  full?: boolean;
}) {
  return (
    <View style={[styles.metricCard, full ? styles.metricCardFull : null, { backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.56)", borderColor: theme.summaryBorder }]}>
      <View style={[styles.metricIconWrap, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: theme.textSoft }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorWrap: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: "center",
  },
  errorCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    gap: 14,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  errorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  errorActions: {
    gap: 10,
    marginTop: 6,
  },
  ambientTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  ambientBeam: {
    position: "absolute",
    top: 116,
    left: -32,
    right: -32,
    height: 280,
    transform: [{ rotate: "-8deg" }],
  },
  ambientBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 40,
    height: 260,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 14,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  topSpacer: {
    width: 40,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  heroMetaRow: {
    flexDirection: "row",
    gap: 10,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaBadgeText: {
    fontSize: 13,
    fontWeight: "800",
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 6,
  },
  summaryCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  metricsCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  detailStack: {
    gap: 10,
  },
  detailRow: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  detailCopy: {
    flex: 1,
    gap: 3,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  detailValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    width: "47%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    alignItems: "flex-start",
    gap: 8,
  },
  metricCardFull: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  actionBlock: {
    gap: 10,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    gap: 14,
    shadowColor: "rgba(6, 14, 28, 0.45)",
    shadowOpacity: 0.34,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 18 },
    elevation: 18,
  },
  modalIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  modalActions: {
    gap: 10,
    marginTop: 2,
  },
});
