import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import { api } from "../../src/api/client";
import { FadeInCard, InputField, ModernButton, ModernScreen, Pill, TitleBlock } from "../../src/ui/modern";

type EquipoItem = {
  id: number;
  serial: string;
  marca: string;
  modelo: string;
  estado: string;
  motivo_rechazo?: string | null;
};

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
      setMsg(e?.response?.data?.message || e?.response?.data?.motivo || "No se pudo registrar el equipo.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <ModernScreen scroll>
      <FadeInCard>
        <Pill text="MIS EQUIPOS" />
        <View style={{ marginTop: 8 }}>
          <TitleBlock title="Gestionar equipos" subtitle="Registra y consulta el estado de tus equipos." />
        </View>
      </FadeInCard>

      <FadeInCard delay={70}>
        <View style={{ gap: 8 }}>
          <InputField label="Serial" value={serial} onChangeText={setSerial} placeholder="ABC1234" />
          <InputField label="Marca" value={marca} onChangeText={setMarca} placeholder="Dell" />
          <InputField label="Modelo" value={modelo} onChangeText={setModelo} placeholder="Inspiron 15" />
          <ModernButton label={saving ? "Guardando..." : "Registrar equipo"} disabled={saving} onPress={crear} />
          {msg ? <Text style={{ color: msg.toLowerCase().includes("correctamente") ? "#15803d" : "#b91c1c" }}>{msg}</Text> : null}
        </View>
      </FadeInCard>

      <FadeInCard delay={120}>
        <ModernButton label={loading ? "Actualizando..." : "Actualizar lista"} tone="light" onPress={cargar} disabled={loading} />
        <View style={{ marginTop: 10 }}>
          {loading ? (
            <ActivityIndicator />
          ) : (
            <FlatList
              data={items}
              scrollEnabled={false}
              keyExtractor={(i) => String(i.id)}
              renderItem={({ item }) => (
                <View
                  style={{
                    backgroundColor: "#f8fafc",
                    borderWidth: 1,
                    borderColor: "#e2e8f0",
                    borderRadius: 12,
                    padding: 10,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontWeight: "900", color: "#0f172a" }}>
                    {item.marca} {item.modelo}
                  </Text>
                  <Text style={{ color: "#64748b" }}>Serial: {item.serial}</Text>
                  <Text style={{ color: "#64748b" }}>Estado: {item.estado}</Text>
                  {item.motivo_rechazo ? <Text style={{ color: "#b91c1c" }}>Motivo: {item.motivo_rechazo}</Text> : null}
                </View>
              )}
              ListEmptyComponent={<Text style={{ color: "#64748b" }}>Aun no tienes equipos registrados.</Text>}
            />
          )}
        </View>
      </FadeInCard>
    </ModernScreen>
  );
}
