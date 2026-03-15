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

export default function GuardLayout() {
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="home" options={{ title: "Dashboard" }} />
      <Stack.Screen name="scan" options={{ title: "Escanear QR / Barras" }} />
      <Stack.Screen name="confirmacion" options={{ title: "Resultado" }} />
      <Stack.Screen name="historial" options={{ title: "Historial" }} />
      <Stack.Screen name="alertas" options={{ title: "Alertas" }} />
      <Stack.Screen name="cierre-turno" options={{ title: "Cierre de turno" }} />
      <Stack.Screen name="turno-finalizado" options={{ title: "" }} />
    </Stack>
  );
}
