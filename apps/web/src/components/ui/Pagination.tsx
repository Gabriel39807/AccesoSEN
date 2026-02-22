"use client";

type PaginationProps = {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
};

export default function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPrev,
  onNext,
  className = "",
}: PaginationProps) {
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(totalCount, page * pageSize);

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="text-sm text-text/80">
        Mostrando <span className="font-semibold text-text">{from}</span> -{" "}
        <span className="font-semibold text-text">{to}</span> de{" "}
        <span className="font-semibold text-text">{totalCount}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anterior
        </button>
        <div className="min-w-32 text-center text-sm text-text/80">
          Pagina <span className="font-semibold text-text">{page}</span> /{" "}
          <span className="font-semibold text-text">{totalPages}</span>
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
