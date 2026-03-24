import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import * as Turnos from "../../src/api/turnos";
import { useSessionStore } from "../../src/store/session";
import { useResolvedThemeMode } from "../../src/store/preferences";
import GuardBottomDock from "../../src/components/guard/GuardBottomDock";
import {
  DailySummarySection,
  EndShiftButton,
  GuardHeader,
  GuardInfoCard,
  guardHomeThemes,
  GuardThemeMode,
} from "../../src/components/guard/GuardHomeSections";

export default function GuardHome() {
  const user = useSessionStore((s) => s.user);
  const turno = useSessionStore((s) => s.turno);
  const insets = useSafeAreaInsets();
  const [endingShift, setEndingShift] = useState(false);
  const [summary, setSummary] = useState<{ ingresos: number | null; salidas: number | null; total: number | null }>({
    ingresos: null,
    salidas: null,
    total: null,
  });

  const mode = useResolvedThemeMode() as GuardThemeMode;
  const theme = guardHomeThemes[mode];

  const firstName = user?.first_name?.trim() || user?.username || "Carlos";
  const documento = user?.documento || "Sin documento";
  const sede = turno?.sede ?? user?.sede_principal ?? "Sin sede";
  const jornada = turno?.jornada ?? "Sin turno";
  const hasTurno = Boolean(turno?.id);

  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, translate]);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      if (!turno?.id) {
        if (!cancelled) {
          setSummary({ ingresos: null, salidas: null, total: null });
        }
        return;
      }

      try {
        const response = await Turnos.resumenTurno(turno.id);
        if (!cancelled) {
          setSummary({
            ingresos: response?.resumen?.ingresos ?? null,
            salidas: response?.resumen?.salidas ?? null,
            total: response?.resumen?.total ?? null,
          });
        }
      } catch {
        if (!cancelled) {
          setSummary({ ingresos: null, salidas: null, total: null });
        }
      }
    }

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, [turno?.id]);

  const onEndShift = async () => {
    if (!turno?.id) {
      Alert.alert("Sin turno", "No hay turno activo para cerrar.");
      return;
    }
    try {
      setEndingShift(true);
      router.push({ pathname: "/guard/cierre-turno", params: { id: String(turno.id) } } as any);
    } finally {
      setTimeout(() => setEndingShift(false), 500);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background[0] }]}>
      <LinearGradient colors={theme.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={mode === "dark" ? ["rgba(92,161,255,0.14)", "rgba(92,161,255,0.03)", "transparent"] : ["rgba(129,176,255,0.14)", "rgba(129,176,255,0.03)", "rgba(255,255,255,0.02)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.ambientTop}
      />
      <LinearGradient
        colors={mode === "dark" ? ["transparent", "rgba(29,107,201,0.08)", "transparent"] : ["transparent", "rgba(191,220,255,0.16)", "rgba(255,255,255,0.04)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ambientBeam}
      />
      <LinearGradient
        colors={mode === "dark" ? ["transparent", "rgba(74,146,239,0.06)", "rgba(74,146,239,0.01)"] : ["rgba(255,255,255,0.02)", "rgba(207,230,255,0.18)", "rgba(239,246,255,0.22)"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.ambientBottom}
      />
      <Animated.View
        style={[
          styles.flex,
          {
            opacity: fade,
            transform: [{ translateY: translate }],
          },
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 12) + 10,
              paddingBottom: 154 + Math.max(insets.bottom, 8),
            },
          ]}
        >
          <View style={styles.headerTopRow}>
            <GuardHeader theme={theme} />
          </View>

          <GuardInfoCard
            theme={theme}
            guardName={firstName}
            documentId={documento}
            siteName={String(sede)}
            shiftName={String(jornada)}
            shiftStatus={hasTurno ? "En servicio" : "Sin turno"}
          />

          <DailySummarySection
            theme={theme}
            ingresos={summary.ingresos}
            salidas={summary.salidas}
            total={summary.total}
          />

          <View style={styles.ctaWrap}>
            <EndShiftButton theme={theme} disabled={!hasTurno} loading={endingShift} onPress={onEndShift} />
            <Text style={[styles.helperText, { color: theme.textSoft }]}>
              {hasTurno ? "Cierra el turno cuando finalices la jornada del guarda." : "El boton se activara al iniciar un turno."}
            </Text>
          </View>
        </ScrollView>
      </Animated.View>

      <GuardBottomDock active="inicio" mode={mode} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 18,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    bottom: 108,
    height: 250,
  },
  ctaWrap: {
    gap: 10,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    paddingHorizontal: 4,
  },
});
