import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { api } from "@/lib/api";
import { clearTokens } from "@/lib/auth";

export async function logoutCurrentSession(router: AppRouterInstance) {
  try {
    await api.post(
      "/api/auth/logout-all/",
      { auth_transport: "cookie" },
      { headers: { "X-Auth-Transport": "cookie" } },
    );
  } catch {
    // Best effort revocation.
  }

  clearTokens();
  router.replace("/login");
}
