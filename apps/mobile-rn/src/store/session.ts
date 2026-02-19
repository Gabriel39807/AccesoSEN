import { create } from "zustand";
import { clearTokens, getAccessToken } from "../storage/tokens";
import * as Auth from "../api/auth";
import { toUiErrorMessage } from "../api/client";
import * as Turnos from "../api/turnos";

type SessionState = {
  isReady: boolean;
  user: Auth.Usuario | null;
  turno: Turnos.Turno | null;

  bootstrap: () => Promise<void>;

  signIn: (p: {
    username: string;
    password: string;
    rol: "guarda" | "aprendiz";
    sede?: Turnos.Sede;
    jornada?: Turnos.Jornada;
  }) => Promise<void>;
  signInGuarda: (p: {
    username: string;
    password: string;
    sede: Turnos.Sede;
    jornada: Turnos.Jornada;
  }) => Promise<void>;

  finalizarTurno: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  isReady: false,
  user: null,
  turno: null,

  bootstrap: async () => {
    try {
      const access = await getAccessToken();
      if (!access) {
        set({ isReady: true, user: null, turno: null });
        return;
      }

      const me = await Auth.me();

      // ✅ permitir guarda y aprendiz
      if (me.usuario.rol !== "guarda" && me.usuario.rol !== "aprendiz") {
        await clearTokens();
        set({ isReady: true, user: null, turno: null });
        return;
      }

      // guarda puede traer turno actual
      let turno: Turnos.Turno | null = null;
      if (me.usuario.rol === "guarda") {
        const actual = await Turnos.estadoActualGuardia();
        turno = actual.turno_activo ? actual.turno : null;
      }

      set({ isReady: true, user: me.usuario, turno });
    } catch {
      await clearTokens();
      set({ isReady: true, user: null, turno: null });
    }
  },

  signIn: async ({ username, password, rol, sede, jornada }) => {
    // 1) token
    await Auth.login(username, password, rol);

    // 2) me
    const me = await Auth.me();

    if (rol === "guarda" && me.usuario.rol !== "guarda") {
      await clearTokens();
      throw new Error("Este usuario no es personal de seguridad (guarda).");
    }
    if (rol === "aprendiz" && me.usuario.rol !== "aprendiz") {
      await clearTokens();
      throw new Error("Este usuario no es aprendiz.");
    }

    // 3) turno solo para guarda
    if (rol === "guarda") {
      const estado = await Turnos.estadoActualGuardia();
      if (estado.turno_activo && estado.turno) {
        set({ user: me.usuario, turno: estado.turno });
        return;
      }

      if (!sede || !jornada) throw new Error("Selecciona sede y jornada.");
      try {
        const r = await Turnos.iniciarTurno(sede, jornada);
        set({ user: me.usuario, turno: r.turno });
        return;
      } catch (e: any) {
        const data = e?.response?.data;
        if (data?.turno) {
          set({ user: me.usuario, turno: data.turno });
          return;
        }
        throw new Error(toUiErrorMessage(e, "No se pudo iniciar el turno."));
      }
    }

    // aprendiz
    set({ user: me.usuario, turno: null });
  },

  signInGuarda: async ({ username, password, sede, jornada }) => {
    await get().signIn({ username, password, rol: "guarda", sede, jornada });
  },

  finalizarTurno: async () => {
    try {
      const r = await Turnos.finalizarTurno();
      set({ turno: r.turno });
    } catch {
      // no revientes
    }
  },

  signOut: async () => {
    await clearTokens();
    set({ user: null, turno: null });
  },
}));
