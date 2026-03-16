import { Stack, router } from "expo-router";
import { useEffect } from "react";

import { useSessionStore } from "../src/store/session";
import { SystemBrandingProvider } from "../src/theme/system-branding";
import { FadeInCard, LoadingBlock, ModernScreen, Pill, TitleBlock } from "../src/ui/modern";

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
      <ModernScreen contentStyle={{ justifyContent: "center" }}>
        <FadeInCard style={{ gap: 16 }}>
          <Pill text="INICIALIZANDO" />
          <TitleBlock
            title="Preparando entorno seguro"
            subtitle="Estamos restaurando sesión, permisos y contexto operativo del dispositivo."
          />
          <LoadingBlock label="Sincronizando acceso institucional" />
        </FadeInCard>
      </ModernScreen>
    );
  }

  return (
    <SystemBrandingProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SystemBrandingProvider>
  );
}
