import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GuardHomeScreen } from "../screens/guard/GuardHomeScreen";
import { ScanQrScreen } from "../screens/guard/ScanQrScreen";
import { ConfirmacionScreen } from "../screens/guard/ConfirmacionScreen";
import { TurnoFinalizadoScreen } from "../screens/guard/TurnoFinalizadoScreen";
import { ValidarDocumentoOK } from "../api/accesos";

export type GuardStackParamList = {
  GuardHome: undefined;
  ScanQr: undefined;
  Confirmacion:
    | { status: "ok"; documento: string; data: ValidarDocumentoOK; flow?: "auto-ingreso" | "manual-salida" }
    | { status: "notfound"; documento: string }
    | { status: "denied"; documento: string; motivo: string };
  TurnoFinalizado: undefined;
};

const Stack = createNativeStackNavigator<GuardStackParamList>();

export function GuardStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="GuardHome" component={GuardHomeScreen} options={{ title: "Panel Personal de Seguridad" }} />
      <Stack.Screen name="ScanQr" component={ScanQrScreen} options={{ title: "Escanear QR / Barras" }} />
      <Stack.Screen name="Confirmacion" component={ConfirmacionScreen} options={{ title: "Confirmacion" }} />
      <Stack.Screen name="TurnoFinalizado" component={TurnoFinalizadoScreen} options={{ title: "" }} />
    </Stack.Navigator>
  );
}
