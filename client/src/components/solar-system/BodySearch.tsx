import { useState, useRef, useEffect, useCallback } from "react";
import { BODIES, type Body } from "./bodies";

type Props = {
  onSelect: (bodyId: string) => void;
  open: boolean;
  onClose: () => void;
  bodies?: Body[];
};

export default function BodySearch({ onSelect, open, onClose, bodies = BODIES }: Props) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = query
    ? bodies.filter((b) => b.name.toLowerCase().includes(query.toLowerCase()))
    : bodies;

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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[15vh] animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-[calc(100%-1rem)] max-w-md mx-2 rounded-2xl border border-white/15 bg-gray-950/95 shadow-2xl backdrop-blur-xl overflow-hidden">
        <div className="border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search celestial bodies..."
            className="w-full border-0 bg-transparent px-4 py-4 text-sm text-white outline-none placeholder:text-white/40"
          />
        </div>
        {results.length > 0 && (
          <div className="max-h-[50vh] overflow-y-auto overscroll-contain py-1">
            {results.map((body, idx) => (
              <button
                key={body.id}
                onClick={() => {
                  onSelect(body.id);
                  onClose();
                }}
                onMouseEnter={() => setActiveIdx(idx)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-all duration-150 min-h-[52px] ${
                  idx === activeIdx 
                    ? "bg-white/10 text-white scale-[0.98]" 
                    : "text-white/60 hover:bg-white/5 hover:text-white active:scale-95"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full shrink-0 shadow-lg"
                  style={{ backgroundColor: body.color, boxShadow: `0 0 8px ${body.color}40` }}
                />
                <span className="flex-1">{body.name}</span>
                <span className="text-[10px] text-white/30">
                  {body.type.replace(/([A-Z])/g, " $1").trim()}
                </span>
              </button>
            ))}
          </div>
        )}
        {query && results.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-white/40">
            No bodies match <span className="text-white/60">"{query}"</span>
          </div>
        )}
      </div>
    </div>
  );
}
