/**
 * Pantalla móvil de equipos del aprendiz.
 *
 * Responsabilidad:
 * - Registrar equipos del aprendiz.
 * - Mostrar estado de carga al consultar o guardar.
 * - Informar errores de forma visible sin romper la navegación.
 */
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { api, toUiErrorMessage } from "../../src/api/client";
import { EmptyState, FadeInCard, InputField, LoadingBlock, ModernButton, ModernScreen, Pill, TitleBlock, uiTheme } from "../../src/ui/modern";

type EquipoItem = {
  id: number;
  serial: string;
  marca: string;
  modelo: string;
  estado: string;
  motivo_rechazo?: string | null;
};

function estadoTone(estado: string) {
  const value = String(estado || "").toUpperCase();
  if (value.includes("APRO")) return { color: uiTheme.success, bg: `${uiTheme.success}18` };
  if (value.includes("RECH")) return { color: uiTheme.danger, bg: `${uiTheme.danger}18` };
  return { color: uiTheme.warn, bg: `${uiTheme.warn}18` };
}

export default function AprendizEquipos() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [items, setItems] = useState<EquipoItem[]>([]);

  const [serial, setSerial] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");

  async function cargar() {
    setLoading(true);
    try {
      const r = await api.get<EquipoItem[] | { results: EquipoItem[] }>("/api/equipos/");
      const data = Array.isArray(r.data) ? r.data : r.data?.results ?? [];
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function crear() {
    setMsg(null);
    if (!serial.trim() || !marca.trim() || !modelo.trim()) {
      setMsg("Serial, marca y modelo son obligatorios.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/api/equipos/", {
        serial: serial.trim(),
        marca: marca.trim(),
        modelo: modelo.trim(),
      });
      setSerial("");
      setMarca("");
      setModelo("");
      setMsg("Equipo registrado correctamente.");
      await cargar();
    } catch (e: any) {
      setMsg(toUiErrorMessage(e, "No se pudo registrar el equipo."));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  const availableSlots = useMemo(() => Math.max(0, 4 - items.length), [items.length]);

  return (
    <ModernScreen scroll>
      <FadeInCard delay={0} style={{ gap: 16 }}>
        <Pill text="MIS EQUIPOS" />
        <View
          style={{
            borderRadius: 30,
            backgroundColor: "rgba(15,118,110,0.1)",
            borderWidth: 1,
            borderColor: "rgba(15,118,110,0.16)",
            padding: 18,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={{ color: uiTheme.accentDeep, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
                Inventario personal
              </Text>
              <Text style={{ color: uiTheme.ink, fontSize: 28, lineHeight: 32, fontWeight: "900", letterSpacing: -0.8 }}>
                Gestiona tus equipos
              </Text>
              <Text style={{ color: uiTheme.inkSoft, lineHeight: 20 }}>
                Registra tus equipos y revisa su estado de aprobación antes de llegar al control de acceso.
              </Text>
            </View>
            <View style={{ width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.62)", borderWidth: 1, borderColor: "rgba(15,118,110,0.12)" }}>
              <Ionicons name="laptop-outline" size={24} color={uiTheme.accentDeep} />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.62)" }}>
              <Text style={{ color: uiTheme.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>Registrados</Text>
              <Text style={{ color: uiTheme.ink, fontWeight: "900", fontSize: 22, marginTop: 6 }}>{items.length}</Text>
            </View>
            <View style={{ flex: 1, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.62)" }}>
              <Text style={{ color: uiTheme.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>Cupos</Text>
              <Text style={{ color: uiTheme.ink, fontWeight: "900", fontSize: 22, marginTop: 6 }}>{availableSlots}</Text>
            </View>
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={70} style={{ gap: 12 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: uiTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>Registrar nuevo equipo</Text>
          <TitleBlock title="Agrega un dispositivo" subtitle="Completa serial, marca y modelo para enviarlo a revisión." />
        </View>

        <InputField label="Serial" value={serial} onChangeText={setSerial} placeholder="ABC1234" />
        <InputField label="Marca" value={marca} onChangeText={setMarca} placeholder="Dell" />
        <InputField label="Modelo" value={modelo} onChangeText={setModelo} placeholder="Inspiron 15" />
        <ModernButton label={saving ? "Guardando..." : "Registrar equipo"} disabled={saving} onPress={crear} />
        {msg ? <Text style={{ color: msg.toLowerCase().includes("correctamente") ? uiTheme.success : uiTheme.danger, lineHeight: 20 }}>{msg}</Text> : null}
      </FadeInCard>

      <FadeInCard delay={120} style={{ gap: 12 }}>
        <ModernButton label={loading ? "Actualizando..." : "Actualizar lista"} tone="light" onPress={cargar} disabled={loading} />
        {loading ? (
          <LoadingBlock label="Consultando inventario personal" />
        ) : (
          <FlatList
            data={items}
            scrollEnabled={false}
            keyExtractor={(i) => String(i.id)}
            renderItem={({ item }) => {
              const tone = estadoTone(item.estado);
              return (
                <View
                  style={{
                    backgroundColor: "rgba(255,255,255,0.78)",
                    borderWidth: 1,
                    borderColor: "rgba(148,163,184,0.22)",
                    borderRadius: 20,
                    padding: 14,
                    marginBottom: 10,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontWeight: "900", color: uiTheme.ink, flex: 1 }}>{item.marca} {item.modelo}</Text>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: tone.bg, borderWidth: 1, borderColor: `${tone.color}26` }}>
                      <Text style={{ color: tone.color, fontWeight: "900", fontSize: 11 }}>{item.estado}</Text>
                    </View>
                  </View>
                  <Text style={{ color: uiTheme.inkSoft }}>Serial: {item.serial}</Text>
                  {item.motivo_rechazo ? <Text style={{ color: uiTheme.danger, lineHeight: 20 }}>Motivo: {item.motivo_rechazo}</Text> : null}
                </View>
              );
            }}
            ListEmptyComponent={
              <EmptyState
                icon="laptop-outline"
                title="Sin equipos registrados"
                subtitle="Agrega tu primer equipo para enviarlo a revisión y mantener tu inventario personal al día."
              />
            }
          />
        )}
      </FadeInCard>
    </ModernScreen>
  );
}
