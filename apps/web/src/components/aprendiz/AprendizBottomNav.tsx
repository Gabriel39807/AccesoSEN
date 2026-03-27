"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconLaptop, IconUser } from "./icons";

function Item({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "flex flex-col items-center justify-center gap-1 py-2 text-xs transition " +
        (active ? "text-emerald-400" : "text-[color:var(--text-muted)]")
      }
    >
      <span className={"h-6 w-6 " + (active ? "text-emerald-400" : "text-[color:var(--text-muted)]")}>{icon}</span>
      <span className={active ? "font-semibold" : ""}>{label}</span>
    </Link>
  );
}

export default function AprendizBottomNav() {
  const pathname = usePathname();
  const isInicio = pathname === "/aprendiz" || pathname.startsWith("/aprendiz/inicio");
  const isEquipos = pathname.startsWith("/aprendiz/equipos");
  const isPerfil = pathname.startsWith("/aprendiz/perfil");

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-surface-border bg-[color:color-mix(in_srgb,var(--surface)_94%,transparent)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-3">
        <Item href="/aprendiz/inicio" label="Inicio" active={isInicio} icon={<IconHome className="h-6 w-6" />} />
        <Item href="/aprendiz/equipos" label="Mis equipos" active={isEquipos} icon={<IconLaptop className="h-6 w-6" />} />
        <Item href="/aprendiz/perfil" label="Mi perfil" active={isPerfil} icon={<IconUser className="h-6 w-6" />} />
      </div>
    </div>
  );
}
