import { NextRequest, NextResponse } from "next/server";
import { API_BASE, joinApiPath } from "@/lib/api-config";
import { resolveRouteAccess } from "@/lib/route-access";

const REFRESH_COOKIE_NAME = "sadi_refresh";

type SessionInfo = {
  ok: boolean;
  role: string | null;
  access: string | null;
  setCookie: string | null;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function refreshSession(request: NextRequest): Promise<SessionInfo> {
  const refreshCookie = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (!refreshCookie || !API_BASE) {
    return { ok: false, role: null, access: null, setCookie: null };
  }

  try {
    const refreshResponse = await fetch(joinApiPath("/api/token/refresh/"), {
      method: "POST",
      headers: {
        cookie: `${REFRESH_COOKIE_NAME}=${refreshCookie}`,
        "content-type": "application/json",
        "x-auth-transport": "cookie",
      },
      body: JSON.stringify({ auth_transport: "cookie" }),
      cache: "no-store",
    });

    if (!refreshResponse.ok) {
      return {
        ok: false,
        role: null,
        access: null,
        setCookie: refreshResponse.headers.get("set-cookie"),
      };
    }

    const payload = (await refreshResponse.json()) as { access?: string };
    const access = String(payload?.access || "").trim();
    const decoded = access ? decodeJwtPayload(access) : null;
    const role = typeof decoded?.rol === "string" ? decoded.rol : null;

    return {
      ok: Boolean(access && role),
      role,
      access: access || null,
      setCookie: refreshResponse.headers.get("set-cookie"),
    };
  } catch {
    return { ok: false, role: null, access: null, setCookie: null };
  }
}

function redirectToLogin(request: NextRequest) {
  const target = new URL("/login", request.url);
  if (request.nextUrl.pathname !== "/login") {
    target.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  }
  return NextResponse.redirect(target);
}

function buildAuthorizedResponse(request: NextRequest, session: SessionInfo) {
  const requestHeaders = new Headers(request.headers);
  if (session.access) requestHeaders.set("x-sadi-access-token", session.access);
  if (session.role) requestHeaders.set("x-sadi-role", session.role);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (session.setCookie) response.headers.append("set-cookie", session.setCookie);
  return response;
}

export async function middleware(request: NextRequest) {
  if (process.env.NEXT_DISABLE_EDGE_AUTH_GUARD === "true") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname === "/login";
  const isAdminRoute = pathname.startsWith("/admin");
  const isAprendizRoute = pathname.startsWith("/aprendiz");
  const isProtectedRoute = isAdminRoute || isAprendizRoute;

  if (!isLoginRoute && !isProtectedRoute) {
    return NextResponse.next();
  }

  const session = await refreshSession(request);
  if (!session.ok || !session.role) {
    return isProtectedRoute ? redirectToLogin(request) : NextResponse.next();
  }

  if (isLoginRoute) {
    const decision = resolveRouteAccess(pathname, session.role as "superadmin" | "admin_sede" | "aprendiz" | "guarda");
    if (decision.kind === "redirect") {
      return NextResponse.redirect(new URL(decision.destination, request.url));
    }
    return NextResponse.next();
  }

  const decision = resolveRouteAccess(pathname, session.role as "superadmin" | "admin_sede" | "aprendiz" | "guarda");
  if (decision.kind === "redirect") {
    if (decision.destination === "/login") {
      return redirectToLogin(request);
    }
    return NextResponse.redirect(new URL(decision.destination, request.url));
  }

  return buildAuthorizedResponse(request, session);
}

export const config = {
  matcher: ["/login", "/admin/:path*", "/aprendiz/:path*"],
};
