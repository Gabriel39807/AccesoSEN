import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useColorScheme } from "react-native";

export type AppThemeMode = "light" | "dark";

type NotificationPreferences = {
  enabled: boolean;
  operativas: boolean;
  novedades: boolean;
};

type PreferencesState = {
  themeMode: AppThemeMode | null;
  notifications: NotificationPreferences;
  setThemeMode: (mode: AppThemeMode) => void;
  toggleThemeMode: () => void;
  setNotificationPreference: <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      themeMode: null,
      notifications: {
        enabled: true,
        operativas: true,
        novedades: true,
      },
      setThemeMode: (mode) => set({ themeMode: mode }),
      toggleThemeMode: () =>
        set((state) => ({
          themeMode: (state.themeMode ?? "dark") === "dark" ? "light" : "dark",
        })),
      setNotificationPreference: (key, value) =>
        set((state) => ({
          notifications: {
            ...state.notifications,
            [key]: value,
          },
        })),
    }),
    {
      name: "sadi-mobile-preferences",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        notifications: state.notifications,
      }),
    }
  )
);

export function useResolvedThemeMode(): AppThemeMode {
  const systemScheme = useColorScheme();
  const preferredMode = usePreferencesStore((state) => state.themeMode);
  return preferredMode ?? (systemScheme === "dark" ? "dark" : "light");
}
