import { useState } from "react";
import { Zap } from "lucide-react";
import type { Category } from "../../api/client";
import { SearchInput } from "../ds";

interface CategorySidebarProps {
  categories: Category[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  allLabel?: string;
}

const LATEST_ID = "__latest__";

export function CategorySidebar({ categories, selected, onSelect, allLabel = "All" }: CategorySidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  return (
    <aside className="xcatside">
      <div className="xcatside__search">
        <SearchInput placeholder="Search categories…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="xcatlist">
        <button className={"xcat" + (selected === null ? " is-active" : "")} onClick={() => onSelect(null)}>
          {allLabel}
        </button>
        {filtered.map((cat) => {
          const latest = cat.category_id === LATEST_ID;
          return (
            <button
              key={cat.category_id}
              className={"xcat" + (selected === cat.category_id ? " is-active" : "") + (latest ? " xcat--latest" : "")}
              onClick={() => onSelect(cat.category_id)}
            >
              {latest ? <Zap size={16} /> : null}
              {cat.name}
            </button>
          );
        })}
        {filtered.length === 0 && search && (
          <p style={{ padding: "10px 13px", fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>No matches</p>
        )}
      </div>
    </aside>
  );
}
