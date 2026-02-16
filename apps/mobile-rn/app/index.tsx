import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useSessionStore } from "../src/store/session";
import { FadeInCard, ModernButton, ModernScreen, Pill, TitleBlock } from "../src/ui/modern";

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
    <ModernScreen contentStyle={{ justifyContent: "center" }}>
      <FadeInCard delay={0}>
        <Pill text="ACCESO SENA TUNJA" />
        <View style={{ marginTop: 10 }}>
          <TitleBlock title="SADI Movil" subtitle="Selecciona tu rol para continuar en una experiencia segura y moderna." />
        </View>
      </FadeInCard>

      <FadeInCard delay={90}>
        <View style={{ gap: 10 }}>
          <ModernButton
            label="Personal de Seguridad"
            tone="primary"
            onPress={() => router.push({ pathname: "/auth/login", params: { rol: "guarda" } } as any)}
          />
          <ModernButton
            label="Aprendiz"
            tone="dark"
            onPress={() => router.push({ pathname: "/auth/login", params: { rol: "aprendiz" } } as any)}
          />
        </View>
      </FadeInCard>

      <Text style={{ textAlign: "center", color: "#64748b", marginTop: 8 }}>
        Admin no esta disponible en movil.
      </Text>
    </ModernScreen>
  );
}
