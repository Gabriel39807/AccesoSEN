import React, { useEffect, useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { GuardStackParamList } from "../../navigation/GuardStack";
import { useSessionStore } from "../../store/session";
import { api } from "../../api/client";

type Props = NativeStackScreenProps<GuardStackParamList, "GuardHome">;

type Acceso = {
  id: number;
  tipo: "ingreso" | "salida";
  fecha: string;
  usuario: number;
  sede?: string | null;
};

export function GuardHomeScreen({ navigation }: Props) {
  const user = useSessionStore((s) => s.user);
  const turno = useSessionStore((s) => s.turno);
  const finalizarTurno = useSessionStore((s) => s.finalizarTurno);

  const [recientes, setRecientes] = useState<Acceso[]>([]);

  async function cargarRecientes() {
    try {
      const r = await api.get("/api/accesos/?page=1");
      const results = r.data?.results ?? [];
      setRecientes(results.slice(0, 5));
    } catch {
      // noop
    }
  }

  useEffect(() => {
    cargarRecientes();
  }, []);

  async function onCerrarSesion() {
    // Según el PDF: finaliza turno y luego muestra pantalla de "Turno Finalizado"
    await finalizarTurno();
    navigation.navigate("TurnoFinalizado");
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 18, fontWeight: "800" }}>Panel Personal de Seguridad</Text>
        <Pressable onPress={onCerrarSesion} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#eee" }}>
          <Text style={{ fontWeight: "700" }}>Cerrar Sesión</Text>
        </Pressable>
      </View>

      <View style={{ padding: 14, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee" }}>
        <Text style={{ opacity: 0.7 }}>Bienvenido,</Text>
        <Text style={{ fontSize: 18, fontWeight: "800" }}>{user?.first_name ? `${user.first_name} ${user.last_name ?? ""}` : user?.username}</Text>
        <Text style={{ marginTop: 6, opacity: 0.8 }}>
          Turno: {turno?.jornada ?? "-"} | Sede: {turno?.sede ?? "-"}
        </Text>
      </View>

      <Pressable
        onPress={() => navigation.navigate("ScanQr")}
        style={{ backgroundColor: "#16a34a", padding: 18, borderRadius: 18, alignItems: "center" }}
      >
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>Escanear Entrada/Salida</Text>
        <Text style={{ color: "#fff", opacity: 0.9 }}>Personas o Equipos Tecnológicos</Text>
      </Pressable>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", marginBottom: 8 }}>Registros Recientes</Text>
        <FlatList
          data={recientes}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee", borderRadius: 14, padding: 12, marginBottom: 10 }}>
              <Text style={{ fontWeight: "800" }}>
                #{item.id} - {item.tipo.toUpperCase()}
              </Text>
              <Text style={{ opacity: 0.7 }}>{new Date(item.fecha).toLocaleString()}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={{ opacity: 0.6 }}>Aún no hay registros.</Text>}
        />
      </View>
    </View>
  );
}
