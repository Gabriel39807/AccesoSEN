import React, { useMemo, useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import * as Accesos from "../../src/api/accesos";
import { toUiErrorMessage } from "../../src/api/client";
import { EmptyState, FadeInCard, LoadingBlock, ModernButton, ModernScreen, NoticeBanner, Pill, SkeletonCard, SkeletonLine, uiTheme } from "../../src/ui/modern";

function ResultHero({
  title,
  subtitle,
  tone,
  icon,
}: {
  title: string;
  subtitle: string;
  tone: "success" | "danger" | "neutral";
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const tones = {
    success: { bg: "rgba(15,118,110,0.1)", border: "rgba(15,118,110,0.16)", fg: uiTheme.accentDeep },
    danger: { bg: "rgba(185,28,28,0.08)", border: "rgba(185,28,28,0.16)", fg: uiTheme.danger },
    neutral: { bg: "rgba(15,23,42,0.92)", border: "rgba(15,23,42,0.16)", fg: "#ffffff" },
  }[tone];

  return (
    <FadeInCard delay={0} style={{ gap: 16 }}>
      <Pill text={tone === "success" ? "ACCESO AUTORIZADO" : "RESULTADO DE VALIDACIÓN"} />
      <View
        style={{
          borderRadius: 30,
          backgroundColor: tones.bg,
          borderWidth: 1,
          borderColor: tones.border,
          padding: 18,
          gap: 14,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={{ color: tone === "neutral" ? "rgba(255,255,255,0.62)" : tones.fg, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
              Control de acceso
            </Text>
            <Text style={{ color: tone === "neutral" ? "#ffffff" : uiTheme.ink, fontSize: 28, lineHeight: 32, fontWeight: "900", letterSpacing: -0.8 }}>
              {title}
            </Text>
            <Text style={{ color: tone === "neutral" ? "rgba(255,255,255,0.76)" : uiTheme.inkSoft, lineHeight: 20 }}>
              {subtitle}
            </Text>
          </View>
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tone === "neutral" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.62)",
              borderWidth: 1,
              borderColor: tone === "neutral" ? "rgba(255,255,255,0.12)" : tones.border,
            }}
          >
            <Ionicons name={icon} size={24} color={tones.fg} />
          </View>
        </View>
      </View>
    </FadeInCard>
  );
}

export default function ConfirmacionScreen() {
  const params = useLocalSearchParams<{
    status: "ok" | "notfound" | "denied";
    documento: string;
    motivo?: string;
    flow?: "auto-ingreso" | "manual-salida";
  }>();

  const documento = params.documento ?? "";
  const status = params.status;
  const flow = params.flow === "auto-ingreso" ? "auto-ingreso" : params.flow === "manual-salida" ? "manual-salida" : "manual";
  const data = status === "ok" ? Accesos.__cache.get(documento) : null;

  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const equipos = useMemo(() => data?.equipos_aprobados ?? [], [data]);

  function toggleEquipo(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function registrar(tipo: "ingreso" | "salida") {
    try {
      setLoading(true);
      await Accesos.registrarPorDocumento(
        { documento, tipo, equipos: selected },
        { idempotencyKey: Accesos.createRegistroIdempotencyKey(documento, tipo) }
      );
      Alert.alert("Listo", `Se registró ${tipo} correctamente.`);
      router.replace("/guard/home");
    } catch (e: any) {
      const motivo = toUiErrorMessage(e, "No se pudo registrar el acceso.");
      Alert.alert("No permitido", motivo);
    } finally {
      setLoading(false);
    }
  }

  if (!status) return null;

  if (status === "notfound") {
    return (
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <ResultHero
          title="Usuario no encontrado"
          subtitle="La información escaneada no corresponde a un usuario registrado en SADI."
          tone="danger"
          icon="close-circle-outline"
        />
        <FadeInCard delay={70}>
          <ModernButton label="Volver a escanear" tone="danger" onPress={() => router.back()} />
        </FadeInCard>
      </ModernScreen>
    );
  }

  if (status === "denied") {
    return (
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <ResultHero
          title="Acceso denegado"
          subtitle={params.motivo ?? "No fue posible autorizar este movimiento desde el punto de control."}
          tone="danger"
          icon="warning-outline"
        />
        <FadeInCard delay={70}>
          <ModernButton label="Volver a escanear" tone="danger" onPress={() => router.back()} />
        </FadeInCard>
      </ModernScreen>
    );
  }

  if (!data) {
    return (
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <FadeInCard style={{ gap: 14 }}>
          <SkeletonLine width="38%" height={12} />
          <SkeletonLine width="68%" height={26} />
          <SkeletonLine width="82%" height={14} />
          <SkeletonCard rows={2} />
          <LoadingBlock label="Preparando validación del acceso" />
        </FadeInCard>
      </ModernScreen>
    );
  }

  const a = data.aprendiz;
  const autoIngreso = flow === "auto-ingreso";
  const salidaPendiente = flow === "manual-salida" || data.estado === "dentro";

  if (autoIngreso) {
    return (
      <ModernScreen scroll>
        <ResultHero
          title="Ingreso registrado"
          subtitle={`${a.first_name} ${a.last_name} ya quedó registrado en ${data.turno?.sede ?? "la sede activa"}.`}
          tone="success"
          icon="checkmark-done-outline"
        />

        <FadeInCard delay={70} style={{ gap: 12 }}>
          <Text style={{ color: uiTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
            Registro automático
          </Text>
          <NoticeBanner
            tone="info"
            text={
              equipos.length > 0
                ? "El ingreso quedó confirmado sin selección manual de equipos. Si necesitas trazarlos, registra esa asociación en el flujo correspondiente."
                : "La validación registró el ingreso de inmediato y el puesto quedó listo para el siguiente escaneo."
            }
          />
          <Text style={{ color: uiTheme.inkSoft, lineHeight: 20 }}>Documento {a.documento}</Text>
        </FadeInCard>

        <FadeInCard delay={120} style={{ gap: 10 }}>
          <ModernButton label="Escanear siguiente" onPress={() => router.replace("/guard/scan")} />
          <ModernButton label="Volver al panel" tone="light" onPress={() => router.replace("/guard/home")} />
        </FadeInCard>
      </ModernScreen>
    );
  }

  return (
    <ModernScreen scroll>
      <ResultHero
        title={`${a.first_name} ${a.last_name}`}
        subtitle={`Documento ${a.documento}`}
        tone="success"
        icon="checkmark-circle-outline"
      />

      <FadeInCard delay={70} style={{ gap: 14 }}>
        <Text style={{ color: uiTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
          Equipos asociados
        </Text>
        <Text style={{ color: uiTheme.inkSoft, lineHeight: 20 }}>
          Marca los equipos que acompañarán este movimiento antes de registrar la salida.
        </Text>

        <FlatList
          data={equipos}
          scrollEnabled={false}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item }) => {
            const checked = selected.includes(item.id);
            return (
              <View
                style={{
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: checked ? "rgba(15,118,110,0.22)" : "rgba(148,163,184,0.22)",
                  backgroundColor: checked ? "rgba(15,118,110,0.08)" : "rgba(255,255,255,0.72)",
                  marginBottom: 10,
                }}
              >
                <ModernButton
                  label={`${checked ? "Seleccionado" : "Seleccionar"}  ${item.marca} ${item.modelo} - ${item.serial}`}
                  tone="light"
                  onPress={() => toggleEquipo(item.id)}
                />
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="Sin equipos aprobados"
              subtitle="Este movimiento no tiene equipos habilitados para asociar en el control de acceso."
            />
          }
        />
      </FadeInCard>

      <FadeInCard delay={120} style={{ gap: 10 }}>
        <Text style={{ color: uiTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
          Registrar movimiento
        </Text>
        <NoticeBanner
          tone="info"
          text={
            salidaPendiente
              ? selected.length > 0
                ? `${selected.length} equipo(s) asociado(s) para la salida.`
                : "El último movimiento es un ingreso. Si corresponde, confirma ahora la salida."
              : selected.length > 0
                ? `${selected.length} equipo(s) asociado(s) para este registro.`
                : "Puedes registrar el acceso sin equipos o seleccionar los aprobados antes de continuar."
          }
        />
        {salidaPendiente ? null : <ModernButton label="Registrar ingreso" onPress={() => registrar("ingreso")} disabled={loading} />}
        <ModernButton label="Registrar salida" tone="danger" onPress={() => registrar("salida")} disabled={loading} />
        {loading ? <LoadingBlock label="Registrando movimiento de acceso" /> : null}
      </FadeInCard>
    </ModernScreen>
  );
}
