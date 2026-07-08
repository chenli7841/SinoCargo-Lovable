import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({ page, pageSize, total, onChange }: {
  page: number; pageSize: number; total: number; onChange: (p: number) => void;
}) {
  if (!total || total <= pageSize) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
      <div>第 {page} / {totalPages} 页 · 共 {total} 条</div>
      <div className="flex gap-1">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 hover:bg-white/5 disabled:opacity-40">
          <ChevronLeft className="h-3 w-3"/>上一页
        </button>
        <button disabled={page >= totalPages} onClick={() => onChange(page + 1)}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 hover:bg-white/5 disabled:opacity-40">
          下一页<ChevronRight className="h-3 w-3"/>
        </button>
      </div>
    </div>
  );
}
