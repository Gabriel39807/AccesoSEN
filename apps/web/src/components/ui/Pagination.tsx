"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

type PaginationProps = {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
  onPageChange?: (page: number) => void;
  showPageNumbers?: boolean;
  siblingCount?: number;
  boundaryCount?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function buildPages(page: number, totalPages: number, siblingCount: number, boundaryCount: number) {
  const pages = new Set<number>();

  for (let i = 1; i <= Math.min(boundaryCount, totalPages); i += 1) pages.add(i);
  for (let i = Math.max(1, totalPages - boundaryCount + 1); i <= totalPages; i += 1) pages.add(i);
  for (let i = Math.max(1, page - siblingCount); i <= Math.min(totalPages, page + siblingCount); i += 1) pages.add(i);

  const sorted = [...pages].sort((a, b) => a - b);
  const output: Array<number | "ellipsis"> = [];

  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) output.push("ellipsis");
    output.push(value);
  });

  return output;
}

export default function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPrev,
  onNext,
  className = "",
  onPageChange,
  showPageNumbers = true,
  siblingCount = 1,
  boundaryCount = 1,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationProps) {
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(totalCount, page * pageSize);
  const pageItems = showPageNumbers && totalPages > 1 ? buildPages(page, totalPages, siblingCount, boundaryCount) : [];

  return (
    <div className={cx("sadi-card rounded-[1.3rem] border px-3.5 py-2.5 sm:px-4", className)}>
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-subtle)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />
              {from}-{to}
            </span>
            <p className="text-[13px] text-[color:var(--text-soft)]">
              <span className="font-semibold text-[color:var(--foreground)]">{totalCount}</span> registros en total
            </p>
          </div>
          <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
            Pagina <span className="font-semibold text-[color:var(--foreground)]">{page}</span> de {Math.max(totalPages, 1)}
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
          {onPageSizeChange ? (
            <label className="flex items-center gap-2 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-subtle)] px-2.5 py-1.5 text-[13px] text-[color:var(--text-soft)]">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">Filas</span>
              <select
                value={pageSize}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
                className="command-noir-control h-8 w-auto min-w-[6.6rem] rounded-xl border-[color:transparent] bg-[color:var(--surface-elevated)] px-2.5 py-1 text-[13px] font-medium"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size} por pagina
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={page <= 1}
              className="inline-flex min-w-22 items-center justify-center gap-1.5 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] px-3 py-1.5 text-[13px] font-medium text-[color:var(--text-soft)] transition hover:border-[color:var(--primary)] hover:text-[color:var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>

            {showPageNumbers && onPageChange ? (
              <div className="hidden flex-wrap items-center gap-1 sm:flex">
                {pageItems.map((item, index) =>
                  item === "ellipsis" ? (
                    <span key={`ellipsis-${index}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--text-faint)]">
                      <MoreHorizontal className="h-4 w-4" />
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => onPageChange(item)}
                      aria-current={item === page ? "page" : undefined}
                      className={cx(
                        "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2.5 text-[13px] font-medium transition",
                        item === page
                          ? "border-[color:var(--primary)] bg-[color:var(--primary-soft)] text-[color:var(--primary-strong)]"
                          : "border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] text-[color:var(--text-soft)] hover:border-[color:var(--primary)] hover:text-[color:var(--foreground)]",
                      )}
                    >
                      {item}
                    </button>
                  ),
                )}
              </div>
            ) : null}

            <div className="inline-flex items-center rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] px-2.5 py-1.5 text-[13px] font-medium text-[color:var(--text-soft)] sm:hidden">
              {page}/{Math.max(totalPages, 1)}
            </div>

            {!showPageNumbers || !onPageChange ? (
              <div className="hidden items-center rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] px-2.5 py-1.5 text-[13px] font-medium text-[color:var(--text-soft)] sm:inline-flex">
                {page}/{Math.max(totalPages, 1)}
              </div>
            ) : null}

            <button
              type="button"
              onClick={onNext}
              disabled={page >= totalPages}
              className="inline-flex min-w-22 items-center justify-center gap-1.5 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] px-3 py-1.5 text-[13px] font-medium text-[color:var(--text-soft)] transition hover:border-[color:var(--primary)] hover:text-[color:var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
