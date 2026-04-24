import { useState } from "react";
import { Search } from "lucide-react";
import type { Category } from "../../api/client";

interface CategorySidebarProps {
  categories: Category[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export function CategorySidebar({ categories, selected, onSelect }: CategorySidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  return (
    <section className="glass-card flex flex-col gap-3 overflow-hidden p-3 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-2rem)] lg:w-64 lg:self-start lg:p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white/35">
            Categories
          </p>
          <p className="mt-1 text-sm text-white/50">Refine the catalog quickly.</p>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/45">
          {filtered.length}
        </span>
      </div>

      <div className="relative flex-shrink-0">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          className="w-full glass-input pl-9 py-2 text-sm"
          placeholder="Search categories"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:flex-1 lg:space-y-1 lg:overflow-x-hidden lg:overflow-y-auto">
        <button
          className={`shrink-0 rounded-full px-3 py-2 text-sm transition-colors lg:w-full lg:rounded-2xl lg:text-left ${
            selected === null
              ? "bg-white font-medium text-slate-900"
              : "border border-white/10 text-white/60 hover:bg-white/5 hover:text-white"
          }`}
          onClick={() => onSelect(null)}
        >
          All
        </button>
        {filtered.map((cat) => (
          <button
            key={cat.category_id}
            className={`shrink-0 rounded-full px-3 py-2 text-sm transition-colors lg:w-full lg:rounded-2xl lg:text-left ${
              selected === cat.category_id
                ? "bg-white font-medium text-slate-900"
                : "border border-white/10 text-white/60 hover:bg-white/5 hover:text-white"
            }`}
            onClick={() => onSelect(cat.category_id)}
          >
            {cat.name}
          </button>
        ))}
        {filtered.length === 0 && search && (
          <p className="px-3 py-2 text-xs text-white/30">No matches</p>
        )}
      </div>
    </section>
  );
}
