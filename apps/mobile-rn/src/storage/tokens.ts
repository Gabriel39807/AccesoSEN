import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const ACCESS_KEY = "sadi_access";
const REFRESH_KEY = "sadi_refresh";
const DEVICE_ID_KEY = "sadi_device_id";
const BIOMETRIC_ENABLED_KEY = "sadi_biometric_enabled";

let memoryAccessToken: string | null = null;

function webSet(key: string, value: string) {
  globalThis?.localStorage?.setItem(key, value);
}

function webGet(key: string) {
  return globalThis?.localStorage?.getItem(key) ?? null;
}

function webDel(key: string) {
  globalThis?.localStorage?.removeItem(key);
}

function createDeviceId(): string {
  const fromCrypto = (globalThis as any)?.crypto?.randomUUID?.();
  if (typeof fromCrypto === "string" && fromCrypto) return `sadi-${fromCrypto}`;

  const rand = Math.random().toString(36).slice(2, 14);
  const ts = Date.now().toString(36);
  return `sadi-${ts}-${rand}`;
}

export async function setAccessToken(access: string | null) {
  memoryAccessToken = access;
  if (Platform.OS === "web") {
    if (access) webSet(ACCESS_KEY, access);
    else webDel(ACCESS_KEY);
  }
}

export async function saveTokens(access: string, refresh: string) {
  await setAccessToken(access);
  if (Platform.OS === "web") {
    webSet(REFRESH_KEY, refresh);
    return;
  }
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function getAccessToken() {
  if (Platform.OS === "web") return webGet(ACCESS_KEY);
  return memoryAccessToken;
}

export async function getRefreshToken() {
  if (Platform.OS === "web") return webGet(REFRESH_KEY);
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function hasRefreshToken() {
  const value = await getRefreshToken();
  return Boolean(value);
}

export async function getOrCreateDeviceId() {
  if (Platform.OS === "web") {
    const existing = webGet(DEVICE_ID_KEY);
    if (existing) return existing;
    const created = createDeviceId();
    webSet(DEVICE_ID_KEY, created);
    return created;
  }

  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = createDeviceId();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, created);
  return created;
}

export async function isBiometricEnabled() {
  if (Platform.OS === "web") return false;
  const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return value === "1";
}

export async function setBiometricEnabled(enabled: boolean) {
  if (Platform.OS === "web") return;
  if (enabled) await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "1");
  else await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
}

export async function clearTokens() {
  await setAccessToken(null);
  if (Platform.OS === "web") {
    webDel(REFRESH_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}
