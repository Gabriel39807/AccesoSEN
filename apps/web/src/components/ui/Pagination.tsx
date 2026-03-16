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
      className={`flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="text-sm text-slate-600">
        Mostrando <span className="font-semibold text-slate-900">{from}</span> -{" "}
        <span className="font-semibold text-slate-900">{to}</span> de{" "}
        <span className="font-semibold text-slate-900">{totalCount}</span>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="min-w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anterior
        </button>
        <div className="min-w-32 text-center text-sm text-slate-600">
          Página <span className="font-semibold text-slate-900">{page}</span> /{" "}
          <span className="font-semibold text-slate-900">{totalPages}</span>
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="min-w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
