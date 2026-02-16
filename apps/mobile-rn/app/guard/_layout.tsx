import { Stack } from "expo-router";

export default function GuardLayout() {
  return (
    <Stack screenOptions={{ headerTitleAlign: "center" }}>
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
