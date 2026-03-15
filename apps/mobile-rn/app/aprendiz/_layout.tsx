import { Stack } from "expo-router";

import { uiTheme } from "../../src/ui/modern";

const screenOptions = {
  headerTitleAlign: "center" as const,
  headerStyle: { backgroundColor: "#f4f8f8" },
  headerShadowVisible: false,
  headerTintColor: uiTheme.ink,
  headerTitleStyle: { fontWeight: "800" as const, color: uiTheme.ink },
  contentStyle: { backgroundColor: "#eef4f6" },
};

export default function AprendizLayout() {
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="home" options={{ title: "Panel Aprendiz" }} />
      <Stack.Screen name="historial" options={{ title: "Historial" }} />
      <Stack.Screen name="equipos" options={{ title: "Mis Equipos" }} />
      <Stack.Screen name="perfil" options={{ title: "Mi Perfil" }} />
      <Stack.Screen name="ayuda" options={{ title: "Ayuda y Soporte" }} />
      <Stack.Screen name="mi-qr" options={{ title: "Mi QR" }} />
    </Stack>
  );
}
