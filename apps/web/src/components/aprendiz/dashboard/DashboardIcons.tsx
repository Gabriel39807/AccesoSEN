import React from "react";

type IconProps = { className?: string };

function Base({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconHome({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="m3 10.5 9-7 9 7" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </Base>
  );
}

export function IconLaptop({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="4" y="5" width="16" height="11" rx="2.2" />
      <path d="M2.5 19h19" />
    </Base>
  );
}

export function IconHistory({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4.8V9h4.2" />
      <path d="M12 7.5V12l3.2 2.1" />
    </Base>
  );
}

export function IconQr({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <path d="M14 14h2v2h-2zM18 14h3M18 18h3M14 19h2M16 21v-2" />
    </Base>
  );
}

export function IconUser({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </Base>
  );
}

export function IconHelp({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.8 2.8 0 1 1 4.8 2c-.9.8-1.8 1.3-1.8 2.5" />
      <circle cx="12" cy="17.2" r=".8" fill="currentColor" />
    </Base>
  );
}

export function IconLogout({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </Base>
  );
}

export function IconRefresh({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M21 12a9 9 0 0 1-15.4 6.4" />
      <path d="M3 12A9 9 0 0 1 18.2 5.7" />
      <path d="M6.3 18.8H3v-3.2" />
      <path d="M17.7 5.2H21v3.2" />
    </Base>
  );
}

export function IconBell({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M15 18H5.8a1.6 1.6 0 0 1-1.3-2.5A7.7 7.7 0 0 0 6 11V9.8a6 6 0 1 1 12 0V11a7.7 7.7 0 0 0 1.5 4.5 1.6 1.6 0 0 1-1.3 2.5H15" />
      <path d="M10 18a2 2 0 1 0 4 0" />
    </Base>
  );
}

export function IconShield({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M12 3 5 6v5c0 5.1 3 8.8 7 10 4-1.2 7-4.9 7-10V6l-7-3Z" />
      <path d="m9.2 12.4 1.8 1.8 3.8-3.8" />
    </Base>
  );
}

export function IconClock({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 7.8V12l3 1.8" />
    </Base>
  );
}

export function IconArrowRight({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </Base>
  );
}
