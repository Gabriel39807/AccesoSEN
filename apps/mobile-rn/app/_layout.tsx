import { Stack, router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { useSessionStore } from "../src/store/session";

export default function RootLayout() {
  const bootstrap = useSessionStore((s) => s.bootstrap);
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const isReady = useSessionStore((s) => s.isReady);
  const user = useSessionStore((s) => s.user);

  useEffect(() => {
    if (!hasHydrated) return;
    bootstrap();
  }, [hasHydrated, bootstrap]);

  useEffect(() => {
    if (!isReady) return;
    if (!user) router.replace("/");
    else if (user.rol === "guarda") router.replace("/guard/home");
  }, [isReady, user]);

  if (!hasHydrated || !isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
