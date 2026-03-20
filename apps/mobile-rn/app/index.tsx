import React, { useEffect, useRef } from "react";
import { Text, View, StyleSheet, Animated } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useSessionStore } from "../src/store/session";
import { ModernButton } from "../src/ui/modern";

// Premium Constellation Pattern - Strictly Security & Education themed
const PATTERN_ICONS: (keyof typeof Ionicons.glyphMap)[] = [
  "shield-outline", "shield-checkmark-outline", "key-outline", "lock-closed-outline",
  "finger-print-outline", "id-card-outline", "school-outline", "book-outline",
  "library-outline", "person-outline", "people-outline", "scan-outline", 
  "barcode-outline", "time-outline", "location-outline", "checkmark-circle-outline", 
  "eye-outline", "document-text-outline", "desktop-outline", "briefcase-outline"
];

function SwirlingConstellations() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 8000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 8000, useNativeDriver: true })
      ])
    ).start();
  }, [anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -15] });
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '4deg'] });

  // Soft, ethereal, swirling clusters around center-top - Denser implementation
  const positions = [
    // Cluster 1 (Top Left)
    { top: '8%', left: '12%', icon: PATTERN_ICONS[0], size: 36, o: 0.12 },
    { top: '15%', left: '5%', icon: PATTERN_ICONS[1], size: 22, o: 0.08 },
    { top: '22%', left: '18%', icon: PATTERN_ICONS[2], size: 28, o: 0.15 },
    { top: '12%', left: '26%', icon: PATTERN_ICONS[3], size: 20, o: 0.06 },
    
    // Cluster 2 (Top Center/Right)
    { top: '5%', left: '45%', icon: PATTERN_ICONS[4], size: 40, o: 0.09 },
    { top: '10%', left: '65%', icon: PATTERN_ICONS[5], size: 26, o: 0.11 },
    { top: '18%', left: '80%', icon: PATTERN_ICONS[6], size: 32, o: 0.14 },
    { top: '8%', left: '88%', icon: PATTERN_ICONS[7], size: 24, o: 0.07 },
    
    // Cluster 3 (Mid Left)
    { top: '35%', left: '8%', icon: PATTERN_ICONS[8], size: 30, o: 0.10 },
    { top: '45%', left: '16%', icon: PATTERN_ICONS[9], size: 45, o: 0.05 },
    { top: '55%', left: '5%', icon: PATTERN_ICONS[10], size: 22, o: 0.12 },
    
    // Cluster 4 (Center swirling)
    { top: '32%', left: '35%', icon: PATTERN_ICONS[11], size: 25, o: 0.08 },
    { top: '40%', left: '60%', icon: PATTERN_ICONS[12], size: 38, o: 0.11 },
    { top: '50%', left: '45%', icon: PATTERN_ICONS[13], size: 28, o: 0.14 },
    { top: '65%', left: '35%', icon: PATTERN_ICONS[14], size: 34, o: 0.09 },
    
    // Cluster 5 (Mid Right)
    { top: '32%', left: '85%', icon: PATTERN_ICONS[15], size: 26, o: 0.13 },
    { top: '45%', left: '92%', icon: PATTERN_ICONS[16], size: 32, o: 0.07 },
    { top: '55%', left: '78%', icon: PATTERN_ICONS[17], size: 24, o: 0.10 },
    
    // Cluster 6 (Bottom scattered)
    { top: '75%', left: '15%', icon: PATTERN_ICONS[18], size: 30, o: 0.08 },
    { top: '85%', left: '25%', icon: PATTERN_ICONS[19], size: 20, o: 0.11 },
    { top: '70%', left: '55%', icon: PATTERN_ICONS[0], size: 36, o: 0.06 },
    { top: '80%', left: '70%', icon: PATTERN_ICONS[1], size: 26, o: 0.12 },
    { top: '88%', left: '85%', icon: PATTERN_ICONS[2], size: 28, o: 0.09 },
    { top: '92%', left: '45%', icon: PATTERN_ICONS[3], size: 22, o: 0.07 },
    
    // Cluster 7 (Extra ambient)
    { top: '55%', left: '25%', icon: PATTERN_ICONS[6], size: 26, o: 0.09 },
    { top: '75%', left: '45%', icon: PATTERN_ICONS[7], size: 30, o: 0.11 },
    { top: '25%', left: '55%', icon: PATTERN_ICONS[8], size: 22, o: 0.08 }
  ];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY }, { rotate }] }]}>
      {positions.map((item, idx) => (
        <Ionicons
          key={idx}
          name={item.icon}
          size={item.size}
          color="#1e293b" // Deep slate for contrast against white
          style={{
            position: "absolute",
            top: item.top as any,
            left: item.left as any,
            opacity: item.o,
          }}
        />
      ))}
    </Animated.View>
  );
}

export default function RoleSelection() {
  const user = useSessionStore((s) => s.user);

  useEffect(() => {
    if (user?.rol === "guarda") router.replace({ pathname: "/guard/home" } as any);
    if (user?.rol === "aprendiz") {
      if (user?.must_change_password) router.replace({ pathname: "/auth/first-password" } as any);
      else router.replace({ pathname: "/aprendiz/home" } as any);
    }
  }, [user]);

  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <LinearGradient colors={["#e2e8f0", "#f8fafc", "#ffffff"]} style={StyleSheet.absoluteFill} />
      
      <SwirlingConstellations />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 150 }}>
        
        {/* Tech-oriented shield + abstract book motif floating natively on pattern */}
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 80, height: 80, justifyContent: "center", alignItems: "center", marginBottom: 20 }}>
            <Ionicons name="shield" size={80} color="#0f172a" style={{ position: "absolute", opacity: 0.05 }} />
            <Ionicons name="shield-outline" size={76} color="#1e293b" style={{ position: "absolute" }} />
            <Ionicons name="book-outline" size={32} color="#334155" style={{ position: "absolute", marginTop: -4 }} />
          </View>

          <Text style={{
            fontSize: 56, 
            fontWeight: "900", 
            color: "#0f172a", 
            fontFamily: "serif",
            letterSpacing: 2,
            textShadowColor: "rgba(255,255,255,0.9)",
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 6,
          }}>
            S.A.D.I
          </Text>
        </View>
      </View>

      <Animated.View style={{
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        padding: 32,
        paddingBottom: 40,
        shadowColor: "#0f172a",
        shadowOpacity: 0.1,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -10 },
        elevation: 20,
        transform: [{ translateY: slideAnim }]
      }}>
        <Text style={{ fontSize: 26, color: "#1e293b", marginBottom: 8, textAlign: "center", letterSpacing: -0.5 }}>
          ¡Bienvenido a <Text style={{ fontWeight: "900", fontFamily: "serif", letterSpacing: 1 }}>S.A.D.I!</Text>
        </Text>
        <Text style={{ fontSize: 15, color: "#64748b", textAlign: "center", marginBottom: 32, lineHeight: 22, fontWeight: "500" }}>
          Selecciona tu rol de acceso para iniciar sesión:
        </Text>

        <View style={{ gap: 16 }}>
          <ModernButton
            label="Personal de Seguridad"
            tone="guard"
            icon="shield-checkmark"
            glow={true}
            onPress={() => router.push({ pathname: "/auth/login", params: { rol: "guarda" } } as any)}
          />
          <ModernButton
            label="Aprendiz"
            tone="aprendiz"
            icon="bulb"
            glow={true}
            onPress={() => router.push({ pathname: "/auth/login", params: { rol: "aprendiz" } } as any)}
          />
        </View>
        
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 32, opacity: 0.6 }}>
          <Ionicons name="lock-closed" size={12} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={{ textAlign: "center", color: "#64748b", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
            Asegurado por S.A.D.I 2026
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
