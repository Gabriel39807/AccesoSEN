"use client";

import {
  IconClock,
  IconHistory,
  IconLaptop,
  IconUser,
} from "@/components/aprendiz/dashboard/DashboardIcons";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Tone = "dark" | "sky" | "emerald" | "violet";

export type AdminOverviewCard = {
  label: string;
  value: string;
  delta: string;
  caption: string;
  tone: Tone;
  icon: "history" | "user" | "laptop" | "clock";
};

function iconNode(icon: AdminOverviewCard["icon"]) {
  if (icon === "history") return <IconHistory className="h-5 w-5" />;
  if (icon === "user") return <IconUser className="h-5 w-5" />;
  if (icon === "laptop") return <IconLaptop className="h-5 w-5" />;
  return <IconClock className="h-5 w-5" />;
}

function toneAccent(tone: Tone) {
  if (tone === "sky") return { badge: "info", icon: "text-[color:var(--color-primary)]" };
  if (tone === "emerald") return { badge: "success", icon: "text-[color:var(--success)]" };
  if (tone === "violet") return { badge: "info", icon: "text-[color:var(--role-admin)]" };
  return { badge: "neutral", icon: "text-[color:var(--color-text-soft)]" };
}

function OverviewCardItem({ card }: { card: AdminOverviewCard }) {
  const accent = toneAccent(card.tone);

  return (
    <article className="command-noir-metric">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">{card.label}</p>
          <div className="mt-4 flex items-end gap-3">
            <p className="text-3xl font-semibold tracking-[-0.04em] text-[color:var(--color-text)] sm:text-[2.15rem]">{card.value}</p>
            <span className="command-noir-chip" data-tone={accent.badge}>{card.delta}</span>
          </div>
          <p className="mt-3 max-w-[24rem] text-sm leading-relaxed text-[color:var(--color-text-soft)]">{card.caption}</p>
        </div>
        <span className={cx(
          "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--color-border)] bg-[color:rgba(255,255,255,0.04)]",
          accent.icon,
        )}>
          {iconNode(card.icon)}
        </span>
      </div>
    </article>
  );
}

export default function OverviewCards() {
  return (
    <OverviewCardsContent
      cards={[
        {
          label: "Accesos hoy",
          value: "1.284",
          delta: "+14.2%",
          caption: "Flujo operativo estable con trazabilidad por sede.",
          icon: "history",
          tone: "dark",
        },
        {
          label: "Usuarios activos",
          value: "254",
          delta: "+6.8%",
          caption: "Aprendices y guardas con actividad reciente.",
          icon: "user",
          tone: "sky",
        },
        {
          label: "Equipos pendientes",
          value: "18",
          delta: "-4.1%",
          caption: "Solicitudes en validaci?n y aprobaciones por revisar.",
          icon: "laptop",
          tone: "emerald",
        },
        {
          label: "Turnos activos",
          value: "7",
          delta: "+2",
          caption: "Cobertura en curso con monitoreo de apertura y cierre.",
          icon: "clock",
          tone: "violet",
        },
      ]}
    />
  );
}

export function OverviewCardsContent({
  cards,
  loading = false,
}: {
  cards: AdminOverviewCard[];
  loading?: boolean;
}) {
  const safeCards = cards.length
    ? cards
    : [
        {
          label: "Accesos",
          value: "--",
          delta: "sin datos",
          caption: "No fue posible cargar la informaci?n operativa.",
          icon: "history" as const,
          tone: "dark" as const,
        },
      ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4 2xl:gap-5">
      {safeCards.map((card, index) => (
        <OverviewCardItem
          key={`${card.label}-${index}`}
          card={{
            ...card,
            value: loading ? "..." : card.value,
            delta: loading ? "actualizando" : card.delta,
            caption: loading ? "Consultando informaci?n operativa..." : card.caption,
          }}
        />
      ))}
    </div>
  );
}
