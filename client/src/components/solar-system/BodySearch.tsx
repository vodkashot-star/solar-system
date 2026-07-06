import { useState, useRef, useEffect, useCallback } from "react";
import { BODIES } from "./bodies";

type Props = {
  onSelect: (bodyId: string) => void;
  open: boolean;
  onClose: () => void;
};

export default function BodySearch({ onSelect, open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = query
    ? BODIES.filter((b) => b.name.toLowerCase().includes(query.toLowerCase()))
    : BODIES;

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[activeIdx]) {
        onSelect(results[activeIdx].id);
        onClose();
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [results, activeIdx, onSelect, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-xl border border-white/10 bg-gray-950 shadow-2xl backdrop-blur-md">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIdx(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search bodies..."
          className="w-full rounded-t-xl border-0 border-b border-white/10 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
        />
        {results.length > 0 && (
          <div className="max-h-60 overflow-y-auto py-1">
            {results.map((body, idx) => (
              <button
                key={body.id}
                onClick={() => {
                  onSelect(body.id);
                  onClose();
                }}
                onMouseEnter={() => setActiveIdx(idx)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition ${
                  idx === activeIdx ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: body.color }}
                />
                <span>{body.name}</span>
                <span className="ml-auto text-[10px] text-white/30">
                  {body.type.replace(/([A-Z])/g, " $1").trim()}
                </span>
              </button>
            ))}
          </div>
        )}
        {query && results.length === 0 && (
          <div className="px-4 py-3 text-sm text-white/40">No bodies match &quot;{query}&quot;</div>
        )}
      </div>
    </div>
  );
}
