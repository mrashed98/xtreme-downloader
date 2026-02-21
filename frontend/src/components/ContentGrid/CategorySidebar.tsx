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
    <div className="w-48 flex-shrink-0 flex flex-col gap-2 overflow-hidden pr-2">
      <div className="relative flex-shrink-0">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          className="w-full glass-input pl-8 py-1.5 text-xs"
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="space-y-1 overflow-y-auto flex-1">
        <button
          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
            selected === null
              ? "bg-gradient-accent text-white font-medium"
              : "text-white/60 hover:text-white hover:bg-white/5"
          }`}
          onClick={() => onSelect(null)}
        >
          All
        </button>
        {filtered.map((cat) => (
          <button
            key={cat.category_id}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              selected === cat.category_id
                ? "bg-gradient-accent text-white font-medium"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
            onClick={() => onSelect(cat.category_id)}
          >
            {cat.name}
          </button>
        ))}
        {filtered.length === 0 && search && (
          <p className="text-xs text-white/30 px-3 py-2">No matches</p>
        )}
      </div>
    </div>
  );
}
