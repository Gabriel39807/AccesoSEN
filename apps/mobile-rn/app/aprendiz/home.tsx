import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSessionStore } from "../../src/store/session";

export default function AprendizHome() {
  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);

  const fullName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    user?.username ||
    "Aprendiz";
  const documento = user?.documento || "-";
  const programa = user?.programa_formacion || "-";
  const sede = (user as any)?.sede_principal || "";

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar} />
          <Text style={styles.name}>{fullName}</Text>

          <View style={styles.dataRow}>
            <Ionicons name="person-outline" size={22} color="#8b8b8b" />
            <View style={styles.dataText}>
              <Text style={styles.dataLabel}>Documento</Text>
              <Text style={styles.dataValue}>{documento}</Text>
            </View>
          </View>

          <View style={styles.dataRow}>
            <Ionicons name="qr-code-outline" size={22} color="#8b8b8b" />
            <View style={styles.dataText}>
              <Text style={styles.dataLabel}>Programa</Text>
              <Text style={styles.dataValue}>{programa}</Text>
            </View>
          </View>

          {sede ? (
            <View style={styles.dataRow}>
              <Ionicons name="business-outline" size={22} color="#8b8b8b" />
              <View style={styles.dataText}>
                <Text style={styles.dataLabel}>Sede Principal</Text>
                <Text style={styles.dataValue}>{sede}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mis Equipos</Text>
          <Pressable onPress={() => router.push("/aprendiz/equipos" as any)}>
            <Text style={styles.sectionAction}>Ver todos</Text>
          </Pressable>
        </View>

        <Pressable style={styles.teamCard} onPress={() => router.push("/aprendiz/equipos" as any)}>
          <View style={styles.teamIconWrap}>
            <Ionicons name="laptop-outline" size={24} color="#000" />
          </View>
          <View>
            <Text style={styles.teamName}>Mis equipos</Text>
            <Text style={styles.teamSerial}>Consulta tus equipos registrados</Text>
          </View>
        </Pressable>

        <Pressable style={styles.registerCard} onPress={() => router.push("/aprendiz/equipos" as any)}>
          <View style={styles.registerPlus}>
            <Ionicons name="add" size={16} color="#fff" />
          </View>
          <Text style={styles.registerText}>Registrar nuevo</Text>
        </Pressable>

        <View style={styles.quickActions}>
          <Pressable style={styles.primaryAction} onPress={() => router.push("/aprendiz/mi-qr" as any)}>
            <Ionicons name="qr-code-outline" size={20} color="#fff" />
            <Text style={styles.primaryActionText}>Mi QR</Text>
          </Pressable>

          <View style={styles.quickRow}>
            <Pressable style={styles.lightAction} onPress={() => router.push("/aprendiz/perfil" as any)}>
              <Ionicons name="person-outline" size={20} color="#111" />
              <Text style={styles.lightActionText}>Perfil</Text>
            </Pressable>
            <Pressable style={styles.lightAction} onPress={() => router.push("/aprendiz/ayuda" as any)}>
              <Ionicons name="help-circle-outline" size={20} color="#111" />
              <Text style={styles.lightActionText}>Ayuda</Text>
            </Pressable>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Notificaciones Recientes</Text>

        <View style={styles.notificationsCard}>
          <View style={styles.notificationRow}>
            <View style={styles.notificationIconWrap}>
              <Ionicons name="log-in-outline" size={22} color="#000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.notificationTitle}>Panel actualizado</Text>
              <Text style={styles.notificationBody}>Revisa historial, equipos y tu perfil desde este panel.</Text>
            </View>
          </View>
        </View>

        <Pressable
          style={styles.logoutButton}
          onPress={async () => {
            await signOut();
            router.replace("/" as any);
          }}
        >
          <Ionicons name="log-out-outline" size={22} color="#fff" />
          <Text style={styles.logoutText}>Cerrar sesion</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#efefef",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  profileCard: {
    borderWidth: 2,
    borderColor: "#bdbdbd",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#efefef",
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#d1d1d1",
    alignSelf: "center",
  },
  name: {
    textAlign: "center",
    marginTop: 10,
    marginBottom: 8,
    fontSize: 26,
    fontWeight: "700",
    color: "#111",
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 10,
  },
  dataText: {
    flex: 1,
  },
  dataLabel: {
    color: "#666",
    fontSize: 16,
  },
  dataValue: {
    fontSize: 18,
    color: "#111",
    fontWeight: "500",
  },
  sectionHeader: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 36,
    color: "#111",
    fontWeight: "700",
  },
  sectionAction: {
    fontSize: 29,
    color: "#52a9e1",
    fontWeight: "700",
  },
  teamCard: {
    marginTop: 10,
    borderWidth: 2,
    borderColor: "#bdbdbd",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#efefef",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  teamIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#9fd9ff",
    alignItems: "center",
    justifyContent: "center",
  },
  teamName: {
    fontSize: 27,
    fontWeight: "700",
    color: "#111",
  },
  teamSerial: {
    fontSize: 20,
    color: "#666",
  },
  registerCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#c7c7c7",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#efefef",
  },
  registerPlus: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#52a9e1",
    alignItems: "center",
    justifyContent: "center",
  },
  registerText: {
    marginTop: 6,
    color: "#52a9e1",
    fontSize: 29,
    fontWeight: "700",
  },
  quickActions: {
    marginTop: 12,
    gap: 10,
  },
  primaryAction: {
    borderRadius: 14,
    backgroundColor: "#52a9e1",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryActionText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
  },
  lightAction: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#d5d5d5",
    backgroundColor: "#f3f3f3",
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  lightActionText: {
    color: "#111",
    fontSize: 22,
    fontWeight: "600",
  },
  notificationsCard: {
    marginTop: 10,
    borderWidth: 2,
    borderColor: "#bdbdbd",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#efefef",
  },
  notificationRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  notificationIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#9fd9ff",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#111",
  },
  notificationBody: {
    fontSize: 18,
    color: "#666",
    marginTop: 2,
  },
  logoutButton: {
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: "#d93659",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  logoutText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
});
