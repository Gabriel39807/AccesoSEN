import React from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { useSessionStore } from "../src/store/session";

export default function RoleSelection() {
  const user = useSessionStore((s) => s.user);

  React.useEffect(() => {
    if (user?.rol === "guarda") router.replace({ pathname: "/guard/home" } as any);
    if (user?.rol === "aprendiz") {
      if (user?.must_change_password) router.replace({ pathname: "/auth/first-password" } as any);
      else router.replace({ pathname: "/aprendiz/home" } as any);
    }
  }, [user]);

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 14 }}>
      <Text style={{ fontSize: 28, fontWeight: "900", textAlign: "center" }}>SADI</Text>
      <Text style={{ textAlign: "center", opacity: 0.7 }}>
        Selecciona tu rol para continuar
      </Text>

      <Pressable
        onPress={() => router.push({ pathname: "/auth/login", params: { rol: "guarda" } } as any)}
        style={{
          backgroundColor: "#16a34a",
          padding: 16,
          borderRadius: 18,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>Guarda</Text>
        <Text style={{ color: "#fff", opacity: 0.9 }}>Control de acceso</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push({ pathname: "/auth/login", params: { rol: "aprendiz" } } as any)}
        style={{
          backgroundColor: "#111827",
          padding: 16,
          borderRadius: 18,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>Aprendiz</Text>
        <Text style={{ color: "#fff", opacity: 0.9 }}>Consulta tus accesos</Text>
      </Pressable>

      <Text style={{ textAlign: "center", opacity: 0.6, marginTop: 6 }}>
        (Admin no está disponible en móvil)
      </Text>
    </View>
  );
}
