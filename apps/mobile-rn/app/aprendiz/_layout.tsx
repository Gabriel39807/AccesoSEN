import { Stack } from "expo-router";

export default function AprendizLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "#f7f8fb" },
      }}
    >
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="historial" options={{ title: "Historial" }} />
      <Stack.Screen name="equipos" options={{ title: "Mis Equipos" }} />
      <Stack.Screen name="perfil" options={{ title: "Mi Perfil" }} />
      <Stack.Screen name="ayuda" options={{ title: "Ayuda y Soporte" }} />
      <Stack.Screen name="mi-qr" options={{ title: "Mi QR" }} />
    </Stack>
  );
}
