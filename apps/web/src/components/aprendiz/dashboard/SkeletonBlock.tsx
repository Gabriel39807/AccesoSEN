export default function SkeletonBlock({
  className,
}: {
  className?: string;
}) {
  return <div className={`sadi-skeleton rounded-xl ${className ?? "h-4 w-full"}`} />;
}
