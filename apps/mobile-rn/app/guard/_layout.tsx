import { Stack } from "expo-router";

export default function GuardLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, headerTitleAlign: "center" }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="scan" />
      <Stack.Screen name="confirmacion" />
      <Stack.Screen name="historial" />
      <Stack.Screen name="alertas" />
      <Stack.Screen name="ajustes" />
      <Stack.Screen name="info-guarda" />
      <Stack.Screen name="notificaciones" />
      <Stack.Screen name="cierre-turno" />
      <Stack.Screen name="turno-finalizado" />
    </Stack>
  );
}
