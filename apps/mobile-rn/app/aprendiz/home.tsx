import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSessionStore } from "../../src/store/session";
import { EmptyState, FadeInCard, ModernButton, ModernScreen, Pill } from "../../src/ui/modern";
import { useSystemBranding } from "../../src/theme/system-branding";

function DetailRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconWrap}>
        <Ionicons name={icon} size={16} color="#B8C3D1" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function QuickTile({ icon, title, subtitle, onPress, tone = "light" }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void; tone?: "light" | "aprendiz" }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickTile, tone === "aprendiz" ? styles.quickTileAccent : null, pressed ? styles.quickTilePressed : null]}>
      <View style={[styles.quickTileIcon, tone === "aprendiz" ? styles.quickTileIconAccent : null]}>
        <Ionicons name={icon} size={18} color="#F3F7FB" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.quickTileTitle}>{title}</Text>
        <Text style={styles.quickTileSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#7F90A3" />
    </Pressable>
  );
}

export default function AprendizHome() {
  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);
  const { config } = useSystemBranding();

  const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.username || "Aprendiz";
  const documento = user?.documento || "-";
  const programa = user?.programa_formacion || "No definido";
  const sede = (user as any)?.sede_principal || "Sin sede principal";

  return (
    <ModernScreen scroll theme="aprendiz">
      <FadeInCard delay={0} intensity={88} style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={{ flex: 1, gap: 10 }}>
            <Pill text="Mi espacio" icon="person-circle-outline" tone="aprendiz" />
            <View style={{ gap: 6 }}>
              <Text style={styles.heroTitle}>{fullName}</Text>
              <Text style={styles.heroSubtitle}>
                Gestiona tu acceso, tus equipos y tu QR institucional dentro de una experiencia clara y premium.
              </Text>
            </View>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{fullName.slice(0, 1).toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.heroMetaRow}>
          <View style={styles.heroMetaBadge}>
            <Ionicons name="school-outline" size={14} color="#B8C3D1" />
            <Text style={styles.heroMetaText}>{config.nombre_institucion || "SADI"}</Text>
          </View>
          <View style={styles.heroMetaBadge}>
            <Ionicons name="business-outline" size={14} color="#B8C3D1" />
            <Text style={styles.heroMetaText}>{sede}</Text>
          </View>
        </View>
      </FadeInCard>

      <FadeInCard delay={70} intensity={72} style={{ gap: 12 }}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Perfil operativo</Text>
          <Pill text="Seguro" icon="shield-checkmark-outline" tone="primary" />
        </View>
        <DetailRow icon="card-outline" label="Documento" value={documento} />
        <DetailRow icon="library-outline" label="Programa" value={programa} />
        <DetailRow icon="business-outline" label="Sede principal" value={sede} />
      </FadeInCard>

      <FadeInCard delay={140} intensity={72} style={{ gap: 12 }}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Accion principal</Text>
          <Text style={styles.sectionCaption}>Rapida y visible</Text>
        </View>
        <ModernButton icon="qr-code-outline" label="Abrir mi QR" tone="aprendiz" onPress={() => router.push("/aprendiz/mi-qr" as any)} />
        <View style={styles.quickStack}>
          <QuickTile icon="laptop-outline" title="Mis equipos" subtitle="Consulta y administra tus registros." onPress={() => router.push("/aprendiz/equipos" as any)} tone="aprendiz" />
          <QuickTile icon="person-outline" title="Perfil" subtitle="Actualiza tus datos de contacto." onPress={() => router.push("/aprendiz/perfil" as any)} />
          <QuickTile icon="help-circle-outline" title="Ayuda" subtitle="Resuelve dudas frecuentes y soporte." onPress={() => router.push("/aprendiz/ayuda" as any)} />
        </View>
      </FadeInCard>

      <FadeInCard delay={210} intensity={64} style={{ gap: 12 }}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Actividad</Text>
          <Text style={styles.sectionCaption}>Panel informativo</Text>
        </View>
        <EmptyState
          icon="notifications-outline"
          title="Sin novedades recientes"
          subtitle="Cuando existan novedades sobre accesos, QR o equipos, apareceran aqui con prioridad clara."
        />
      </FadeInCard>

      <FadeInCard delay={280} intensity={55} style={{ marginBottom: 40, gap: 12 }}>
        <Text style={styles.logoutTitle}>Sesion</Text>
        <ModernButton
          icon="log-out-outline"
          label="Cerrar sesion"
          tone="dark"
          onPress={async () => {
            await signOut();
            router.replace("/" as any);
          }}
        />
      </FadeInCard>
    </ModernScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: 16,
  },
  heroHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    color: "#F3F7FB",
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#B8C3D1",
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(95,209,196,0.14)",
    borderWidth: 1,
    borderColor: "rgba(95,209,196,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#D9FFFA",
  },
  heroMetaRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  heroMetaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  heroMetaText: {
    fontSize: 12,
    color: "#B8C3D1",
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F3F7FB",
    letterSpacing: -0.4,
  },
  sectionCaption: {
    fontSize: 12,
    color: "#7F90A3",
    fontWeight: "600",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 62,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 12,
    color: "#7F90A3",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  detailValue: {
    fontSize: 14,
    color: "#F3F7FB",
    fontWeight: "700",
  },
  quickStack: {
    gap: 10,
  },
  quickTile: {
    minHeight: 78,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quickTileAccent: {
    borderColor: "rgba(95,209,196,0.24)",
    backgroundColor: "rgba(95,209,196,0.12)",
  },
  quickTilePressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  quickTileIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickTileIconAccent: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  quickTileTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F3F7FB",
  },
  quickTileSubtitle: {
    fontSize: 12,
    color: "#B8C3D1",
    lineHeight: 18,
  },
  logoutTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F3F7FB",
  },
});
