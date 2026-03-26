import React, { useMemo, useState } from "react";
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

import * as Accesos from "../../src/api/accesos";
import { toUiErrorMessage } from "../../src/api/client";
import type { EquipoAprobado } from "../../src/api/accesos";
import { ModernButton } from "../../src/ui/modern";
import { useResolvedThemeMode } from "../../src/store/preferences";
import { guardHomeThemes, GuardThemeMode } from "../../src/components/guard/GuardHomeSections";

type ActionType = "ingreso" | "salida";

export default function ConfirmacionScreen() {
  const params = useLocalSearchParams<{
    status: "ok" | "notfound" | "denied";
    documento: string;
    motivo?: string;
  }>();

  const insets = useSafeAreaInsets();
  const mode = useResolvedThemeMode() as GuardThemeMode;
  const theme = guardHomeThemes[mode];
  const isDark = mode === "dark";

  const documento = params.documento ?? "";
  const status = params.status;
  const data = status === "ok" ? Accesos.__cache.get(documento) : null;

  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionType | null>(null);
  const [successAction, setSuccessAction] = useState<ActionType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const equipos = useMemo(() => data?.equipos_aprobados ?? [], [data]);

  function toggleEquipo(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function registrar(tipo: ActionType) {
    try {
      setLoading(true);
      setErrorMessage(null);
      await Accesos.registrarPorDocumento({ documento, tipo, equipos: selected });
      setPendingAction(null);
      setSuccessAction(tipo);
    } catch (e: any) {
      const motivo = toUiErrorMessage(e, "No se pudo registrar el acceso.");
      setPendingAction(null);
      setErrorMessage(motivo);
    } finally {
      setLoading(false);
    }
  }

  function closeSuccess() {
    setSuccessAction(null);
    router.replace("/guard/home");
  }

  if (!status) return null;

  if (status === "ok" && !data) {
    return (
      <View style={[styles.centerState, { backgroundColor: theme.background[0] }]}>
        <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={theme.accentStrong} />
      </View>
    );
  }

  const notFound = status === "notfound";
  const ok = status === "ok" && !!data;

  const title = ok ? "Acceso autorizado" : "Acceso no autorizado";
  const subtitle = ok
    ? "Verifica la informacion y confirma el movimiento."
    : notFound
      ? "No encontramos un usuario asociado al documento escaneado."
      : "La validacion fue rechazada para este acceso.";

  const accent = ok ? theme.accent : theme.warning;
  const accentSoft = ok
    ? isDark ? "rgba(89,185,255,0.14)" : "rgba(45,104,216,0.10)"
    : isDark ? "rgba(255,139,129,0.14)" : "rgba(180,35,24,0.10)";

  const personName = ok ? `${data.aprendiz.first_name} ${data.aprendiz.last_name}` : "Documento no validado";
  const programOrShift = ok ? `${data.turno?.jornada ?? "Sin turno"} · ${data.turno?.sede ?? "Sin sede"}` : params.motivo ?? "Revisa el documento y vuelve a intentarlo.";

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
      <View style={[styles.content, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) + 26 }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.replace("/guard/scan")} style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.72 : 1, borderColor: theme.cardBorder, backgroundColor: theme.sectionBg }]}>
            <Ionicons name="arrow-back" size={18} color={theme.text} />
          </Pressable>
          <Text style={[styles.topLabel, { color: theme.textSoft }]}>Validacion de acceso</Text>
          <View style={styles.topSpacer} />
        </View>

        <View
          style={[
            styles.statusBlock,
            {
              backgroundColor: theme.sectionBg,
              borderColor: theme.cardBorder,
              shadowColor: isDark ? theme.accentGlow : "rgba(120, 158, 224, 0.18)",
            },
          ]}
        >
          <View style={[styles.statusIconWrap, { backgroundColor: accentSoft, borderColor: ok ? theme.cardBorder : "rgba(255,139,129,0.24)" }]}>
            <Ionicons name={ok ? "shield-checkmark-outline" : "close-circle-outline"} size={34} color={accent} />
          </View>
          <View style={styles.statusCopy}>
            <Text style={[styles.statusTitle, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.statusSubtitle, { color: theme.textSoft }]}>{subtitle}</Text>
          </View>
        </View>

        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View
            style={[
              styles.profileCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.profileHeader}>
              <View style={[styles.avatar, { backgroundColor: accentSoft, borderColor: theme.cardBorder }]}>
                <Ionicons name="person-outline" size={30} color={accent} />
              </View>
              <View style={styles.profileTextWrap}>
                <Text style={[styles.personName, { color: theme.text }]}>{personName}</Text>
                <Text style={[styles.personMeta, { color: theme.textMuted }]}>Documento {documento}</Text>
              </View>
            </View>

            <View style={styles.metaGrid}>
              <MetaItem label="Sede" value={ok ? String(data.turno?.sede ?? "--") : "--"} theme={theme} />
              <MetaItem label="Turno / Programa" value={ok ? String(data.turno?.jornada ?? "--") : "--"} theme={theme} />
              <MetaItem label="Estado" value={ok ? "Autorizado" : "No autorizado"} theme={theme} highlight={ok ? theme.success : theme.warning} />
              <MetaItem label="Contexto" value={programOrShift} theme={theme} />
            </View>
          </View>

          <View
            style={[
              styles.equipmentCard,
              {
                backgroundColor: theme.sectionBg,
                borderColor: theme.summaryBorder,
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Equipos aprobados</Text>
              <Text style={[styles.sectionMeta, { color: theme.textSoft }]}>
                {ok ? `${equipos.length} disponible${equipos.length === 1 ? "" : "s"}` : "Sin datos"}
              </Text>
            </View>

            {ok && equipos.length > 0 ? (
              <View style={styles.equipmentList}>
                {equipos.map((item: EquipoAprobado) => {
                  const checked = selected.includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => toggleEquipo(item.id)}
                      style={({ pressed }) => [
                        styles.equipmentRow,
                        {
                          opacity: pressed ? 0.9 : 1,
                          backgroundColor: checked
                            ? isDark ? "rgba(89,185,255,0.12)" : "rgba(45,104,216,0.10)"
                            : isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.58)",
                          borderColor: checked ? theme.cardBorder : theme.summaryBorder,
                        },
                      ]}
                    >
                      <View style={styles.equipmentCopy}>
                        <Text style={[styles.equipmentName, { color: theme.text }]}>{item.marca} {item.modelo}</Text>
                        <Text style={[styles.equipmentMeta, { color: theme.textSoft }]}>Serial {item.serial}</Text>
                      </View>
                      <Ionicons name={checked ? "checkmark-circle" : "ellipse-outline"} size={22} color={checked ? theme.accent : theme.textSoft} />
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyEquipments}>
                <Ionicons name="shield-outline" size={18} color={theme.textSoft} />
                <Text style={[styles.emptyEquipmentsText, { color: theme.textSoft }]}>
                  {ok ? "No hay equipos aprobados asociados a este acceso." : "La validacion no incluye equipos disponibles."}
                </Text>
              </View>
            )}
          </View>

          {errorMessage ? (
            <View style={[styles.errorBox, { backgroundColor: accentSoft, borderColor: theme.summaryBorder }]}>
              <Ionicons name="alert-circle-outline" size={18} color={theme.warning} />
              <Text style={[styles.errorText, { color: theme.warning }]}>{errorMessage}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.actionsBlock}>
          {ok ? (
            <>
              <ModernButton
                label={loading && pendingAction === "ingreso" ? "Registrando ingreso..." : "Registrar ingreso"}
                icon="log-in-outline"
                tone="guard"
                disabled={loading}
                onPress={() => setPendingAction("ingreso")}
              />
              <ModernButton
                label={loading && pendingAction === "salida" ? "Registrando salida..." : "Registrar salida"}
                icon="log-out-outline"
                tone="danger"
                disabled={loading}
                onPress={() => setPendingAction("salida")}
              />
            </>
          ) : (
            <ModernButton label="Volver a escanear" icon="scan-outline" tone="guard" onPress={() => router.replace("/guard/scan")} />
          )}
        </View>
      </View>

      <Modal visible={pendingAction !== null} transparent animationType="fade" onRequestClose={() => !loading && setPendingAction(null)}>
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={isDark ? 46 : 56}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(3, 8, 18, 0.74)" : "rgba(236, 242, 255, 0.82)" }]} />
          <View style={[styles.modalCard, { backgroundColor: theme.sectionBg, borderColor: theme.cardBorder }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: isDark ? "rgba(89,185,255,0.12)" : "rgba(45,104,216,0.10)" }]}>
              <Ionicons name={pendingAction === "salida" ? "log-out-outline" : "log-in-outline"} size={24} color={pendingAction === "salida" ? theme.warning : theme.accent} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {pendingAction === "salida" ? "Confirmar salida" : "Confirmar ingreso"}
            </Text>
            <Text style={[styles.modalText, { color: theme.textSoft }]}>
              {pendingAction === "salida"
                ? "Se registrara la salida del usuario validado. Confirma para continuar."
                : "Se registrara el ingreso del usuario validado. Confirma para continuar."}
            </Text>
            <View style={styles.modalActions}>
              <ModernButton label="Cancelar" tone="light" disabled={loading} onPress={() => setPendingAction(null)} />
              <ModernButton
                label={loading ? "Procesando..." : "Confirmar"}
                tone={pendingAction === "salida" ? "danger" : "guard"}
                disabled={loading}
                onPress={() => pendingAction && registrar(pendingAction)}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={successAction !== null} transparent animationType="fade" onRequestClose={closeSuccess}>
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={isDark ? 46 : 56}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(3, 8, 18, 0.76)" : "rgba(236, 242, 255, 0.84)" }]} />
          <View style={[styles.modalCard, { backgroundColor: theme.sectionBg, borderColor: theme.cardBorder }]}>
            <View style={[styles.successIconWrap, { backgroundColor: isDark ? "rgba(77, 226, 173, 0.12)" : "rgba(17,132,94,0.10)" }]}>
              <Ionicons name="checkmark-circle" size={42} color={theme.success} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {successAction === "salida" ? "Salida registrada" : "Ingreso registrado"}
            </Text>
            <Text style={[styles.modalText, { color: theme.textSoft }]}>
              {successAction === "salida"
                ? "La salida fue registrada correctamente. Ya puedes continuar con la siguiente validacion."
                : "El ingreso fue registrado correctamente. Ya puedes continuar con la siguiente validacion."}
            </Text>
            <ModernButton label="Volver al inicio" tone="guard" onPress={closeSuccess} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MetaItem({
  label,
  value,
  theme,
  highlight,
}: {
  label: string;
  value: string;
  theme: (typeof guardHomeThemes)["light"];
  highlight?: string;
}) {
  return (
    <View style={[styles.metaItem, { backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.56)", borderColor: theme.summaryBorder }]}>
      <Text style={[styles.metaLabel, { color: theme.textSoft }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: highlight ?? theme.text }]} numberOfLines={2}>
        {value}
      </Text>
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
  statusBlock: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  statusIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusCopy: {
    flex: 1,
    gap: 4,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  statusSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 8,
  },
  profileCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  profileTextWrap: {
    flex: 1,
    gap: 4,
  },
  personName: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  personMeta: {
    fontSize: 14,
    fontWeight: "600",
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaItem: {
    width: "47%",
    minHeight: 78,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metaValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  equipmentCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  sectionMeta: {
    fontSize: 12,
    fontWeight: "700",
  },
  equipmentList: {
    gap: 10,
  },
  equipmentRow: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  equipmentCopy: {
    flex: 1,
    gap: 3,
  },
  equipmentName: {
    fontSize: 15,
    fontWeight: "800",
  },
  equipmentMeta: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyEquipments: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  emptyEquipmentsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  actionsBlock: {
    gap: 10,
    paddingTop: 2,
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
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
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
