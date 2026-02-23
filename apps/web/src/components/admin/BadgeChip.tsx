import SharedBadgePill, { type BadgeTone } from "@/components/dashboard/shared/BadgePill";

export default function BadgeChip({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  return <SharedBadgePill tone={tone}>{children}</SharedBadgePill>;
}

