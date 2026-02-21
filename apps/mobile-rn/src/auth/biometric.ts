import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

export async function isBiometricAvailable() {
  if (Platform.OS === "web") return false;
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function authenticateBiometric(promptMessage = "Verifica tu identidad para continuar") {
  if (Platform.OS === "web") return true;

  const available = await isBiometricAvailable();
  if (!available) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "Cancelar",
    disableDeviceFallback: false,
  });
  return Boolean(result.success);
}
