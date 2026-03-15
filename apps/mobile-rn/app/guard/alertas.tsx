import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";

import * as Notifs from "../../src/api/notificaciones";
import { GuardBottomNav } from "../../src/ui/guard-bottom-nav";
import { EmptyState, FadeInCard, ModernButton, ModernScreen, NoticeBanner, Pill, SkeletonList, TitleBlock, uiTheme } from "../../src/ui/modern";

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
    void load();
  }, []);

  const stats = useMemo(() => {
    const unread = items.filter((item) => !item.read_at).length;
    const urgent = items.filter((item) => item.tipo === "URGENT").length;
    return { total: items.length, unread, urgent };
  }, [items]);

  return (
    <ModernScreen scroll bottomAccessory={<GuardBottomNav />}>
      <FadeInCard delay={0} style={{ gap: 14 }}>
        <Pill text="ALERTAS" />
        <View
          style={{
            borderRadius: 30,
            backgroundColor: "rgba(15,23,42,0.92)",
            borderWidth: 1,
            borderColor: "rgba(15,23,42,0.16)",
            padding: 18,
            gap: 14,
          }}
        >
          <TitleBlock title="Centro de alertas" subtitle="Revisa incidencias del turno y prioriza primero lo no atendido." />
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { label: "Activas", value: stats.total, fg: "#ffffff", bg: "rgba(255,255,255,0.08)" },
              { label: "Pendientes", value: stats.unread, fg: "#9ae6b4", bg: "rgba(21,128,61,0.14)" },
              { label: "Urgentes", value: stats.urgent, fg: "#fda4af", bg: "rgba(185,28,28,0.16)" },
            ].map((item) => (
              <View key={item.label} style={{ flex: 1, borderRadius: 18, padding: 12, backgroundColor: item.bg }}>
                <Text style={{ color: "rgba(255,255,255,0.68)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>{item.label}</Text>
                <Text style={{ color: item.fg, fontSize: 24, fontWeight: "900", marginTop: 8 }}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={70} style={{ gap: 12 }}>
        <ModernButton label={loading ? "Actualizando..." : "Actualizar"} tone="light" onPress={load} disabled={loading} />
        {!loading ? <NoticeBanner tone="info" text={stats.unread > 0 ? `${stats.unread} alerta(s) pendiente(s) de lectura en este turno.` : "Todas las alertas visibles ya fueron atendidas o marcadas como leidas."} /> : null}
      </FadeInCard>

      <FadeInCard delay={120} style={{ gap: 12 }}>
        {loading ? (
          <SkeletonList items={3} />
        ) : (
          <FlatList
            data={items}
            scrollEnabled={false}
            keyExtractor={(i) => String(i.id)}
            renderItem={({ item }) => {
              const color = item.tipo === "URGENT" ? uiTheme.danger : item.tipo === "WARNING" ? uiTheme.warn : uiTheme.accent;
              const readLabel = item.read_at ? "Atendida" : "Pendiente";
              return (
                <View
                  style={{
                    backgroundColor: "rgba(255,255,255,0.82)",
                    borderWidth: 1,
                    borderColor: "rgba(148,163,184,0.22)",
                    borderRadius: 22,
                    padding: 14,
                    marginBottom: 10,
                    gap: 10,
                    overflow: "hidden",
                  }}
                >
                  <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, backgroundColor: color }} />
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontWeight: "900", color: uiTheme.ink, flex: 1 }}>{item.titulo}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: item.read_at ? uiTheme.success : color }} />
                        <Text style={{ color: uiTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" }}>{readLabel}</Text>
                      </View>
                    </View>
                    <View style={{ backgroundColor: `${color}18`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: `${color}26` }}>
                      <Text style={{ color, fontWeight: "900", fontSize: 11 }}>{item.tipo}</Text>
                    </View>
                  </View>
                  <Text style={{ color: uiTheme.inkSoft, lineHeight: 20 }}>{item.mensaje}</Text>
                  <Text style={{ color: uiTheme.muted }}>{new Date(item.created_at).toLocaleString()}</Text>
                  <ModernButton
                    label={item.read_at ? "Marcada como leida" : "Marcar como leida"}
                    tone={item.read_at ? "light" : "dark"}
                    onPress={async () => {
                      if (!item.read_at) await Notifs.marcarLeida(item.id);
                      void load();
                    }}
                  />
                </View>
              );
            }}
            ListEmptyComponent={
              <EmptyState
                icon="notifications-off-outline"
                title="Sin alertas activas"
                subtitle="Las incidencias, advertencias y novedades del turno apareceran aqui para gestion inmediata."
              />
            }
          />
        )}
      </FadeInCard>
    </ModernScreen>
  );
}
