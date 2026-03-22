"use client";

import SkeletonBlock from "@/components/dashboard/shared/SkeletonBlock";

type CellVariant =
  | "text"
  | "stack"
  | "pill"
  | "pillStack"
  | "button"
  | "iconButtons"
  | "checkbox";

type ColumnSpec = {
  label: string;
  widthClass?: string;
  align?: "left" | "center" | "right";
  variant?: CellVariant;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function CellSkeleton({
  variant = "text",
  align = "left",
}: {
  variant?: CellVariant;
  align?: "left" | "center" | "right";
}) {
  const alignment =
    align === "right"
      ? "items-end"
      : align === "center"
        ? "items-center"
        : "items-start";

  if (variant === "checkbox") {
    return <SkeletonBlock className="h-4.5 w-4.5 rounded-md" />;
  }

  if (variant === "stack") {
    return (
      <div className={cx("flex flex-col gap-2", alignment)}>
        <SkeletonBlock className="h-4 w-28 rounded-md" />
        <SkeletonBlock className="h-3 w-20 rounded-md opacity-80" />
      </div>
    );
  }

  if (variant === "pill") {
    return <SkeletonBlock className="h-5.5 w-18 rounded-full" />;
  }

  if (variant === "pillStack") {
    return (
      <div className={cx("flex flex-col gap-2", alignment)}>
        <SkeletonBlock className="h-5.5 w-18 rounded-full" />
        <SkeletonBlock className="h-9 w-24 rounded-xl" />
      </div>
    );
  }

  if (variant === "button") {
    return <SkeletonBlock className="h-8.5 w-20 rounded-xl" />;
  }

  if (variant === "iconButtons") {
    return (
      <div className={cx("flex items-center gap-2", align === "right" && "justify-end")}>
        <SkeletonBlock className="h-8.5 w-8.5 rounded-lg" />
        <SkeletonBlock className="h-8.5 w-8.5 rounded-lg" />
        <SkeletonBlock className="h-8.5 w-8.5 rounded-lg" />
      </div>
    );
  }

  return <SkeletonBlock className="h-4 w-24 rounded-md" />;
}

export default function AdminTableSkeleton({
  columns,
  rows = 8,
  showToolbar = true,
  showTabs = true,
}: {
  columns: ColumnSpec[];
  rows?: number;
  showToolbar?: boolean;
  showTabs?: boolean;
}) {
  return (
    <div className="sadi-card-strong overflow-hidden rounded-[1.85rem] border">
      {(showTabs || showToolbar) && (
        <div className="border-b border-[color:var(--surface-border)] bg-[rgba(10,16,24,0.78)] px-4 py-4 sm:px-5">
          {showTabs ? (
            <div className="mb-4 flex flex-wrap gap-2">
              <SkeletonBlock className="h-8 w-16 rounded-full" />
              <SkeletonBlock className="h-8 w-24 rounded-full" />
              <SkeletonBlock className="h-8 w-20 rounded-full" />
            </div>
          ) : null}

          {showToolbar ? (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                <SkeletonBlock className="h-9 w-24 rounded-xl" />
                <SkeletonBlock className="h-9 w-28 rounded-xl" />
                <SkeletonBlock className="h-9 w-20 rounded-xl" />
              </div>
              <SkeletonBlock className="h-10 w-full rounded-xl lg:w-56" />
            </div>
          ) : null}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[rgba(16,23,34,0.94)] text-[color:var(--text-soft)]">
            <tr className="text-left">
              {columns.map((column) => (
                <th
                  key={column.label}
                  className={cx(
                    "px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--text-faint)]",
                    column.widthClass,
                    column.align === "right" && "text-right",
                    column.align === "center" && "text-center",
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--surface-border)] bg-[rgba(8,14,21,0.7)]">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={`skeleton-row-${rowIndex}`} className={cx(rowIndex % 2 === 1 && "bg-[rgba(13,20,30,0.6)]")}>
                {columns.map((column) => (
                  <td
                    key={`${column.label}-${rowIndex}`}
                    className={cx(
                      "px-4 py-3.5",
                      column.align === "right" && "text-right",
                      column.align === "center" && "text-center",
                    )}
                  >
                    <CellSkeleton variant={column.variant} align={column.align} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[color:var(--surface-border)] bg-[rgba(10,16,24,0.78)] px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SkeletonBlock className="h-4 w-32 rounded-md" />
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-9 w-20 rounded-xl" />
            <SkeletonBlock className="h-9 w-9 rounded-lg" />
            <SkeletonBlock className="h-9 w-9 rounded-lg" />
            <SkeletonBlock className="h-9 w-20 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
