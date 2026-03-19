export type AuthenticatedRole = "superadmin" | "admin_sede" | "aprendiz" | "guarda";

export type RouteAccessDecision =
  | { kind: "next" }
  | { kind: "redirect"; destination: string };

function isAdminRole(role: AuthenticatedRole) {
  return role === "superadmin" || role === "admin_sede";
}

export function resolveRouteAccess(pathname: string, role: AuthenticatedRole): RouteAccessDecision {
  if (pathname === "/login") {
    if (role === "aprendiz") return { kind: "redirect", destination: "/aprendiz/inicio" };
    if (isAdminRole(role)) return { kind: "redirect", destination: "/admin/usuarios" };
    return { kind: "next" };
  }

  if (pathname.startsWith("/admin/control-center")) {
    if (role === "superadmin") return { kind: "next" };
    if (role === "aprendiz") return { kind: "redirect", destination: "/aprendiz/inicio" };
    return { kind: "redirect", destination: "/admin/inicio" };
  }

  if (pathname.startsWith("/admin")) {
    if (isAdminRole(role)) return { kind: "next" };
    if (role === "aprendiz") return { kind: "redirect", destination: "/aprendiz/inicio" };
    return { kind: "redirect", destination: "/login" };
  }

  if (pathname.startsWith("/aprendiz")) {
    if (role === "aprendiz") return { kind: "next" };
    if (isAdminRole(role)) return { kind: "redirect", destination: "/admin/inicio" };
    return { kind: "redirect", destination: "/login" };
  }

  return { kind: "next" };
}
