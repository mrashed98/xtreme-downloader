import type { Category } from "../../api/client";

interface CategorySidebarProps {
  categories: Category[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export function CategorySidebar({ categories, selected, onSelect }: CategorySidebarProps) {
  return (
    <div className="w-48 flex-shrink-0 space-y-1 overflow-y-auto pr-2">
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
      {categories.map((cat) => (
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
    </div>
  );
}
