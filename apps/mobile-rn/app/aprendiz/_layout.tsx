import { Stack } from "expo-router";

export default function AprendizLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerTitleAlign: "center",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "#f7f8fb" },
      }}
    >
      <Stack.Screen name="home" />
      <Stack.Screen name="historial" />
      <Stack.Screen name="equipos" />
      <Stack.Screen name="perfil" />
      <Stack.Screen name="ayuda" />
      <Stack.Screen name="mi-qr" />
    </Stack>
  );
}
