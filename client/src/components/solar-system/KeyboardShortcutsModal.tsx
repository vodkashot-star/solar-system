import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Shortcut = {
  keys: string[];
  label: string;
};

const SHORTCUTS: Shortcut[] = [
  { keys: ["Space"], label: "Toggle cinematic tour" },
  { keys: ["←", "→"], label: "Focus previous / next body" },
  { keys: ["Esc"], label: "Close panels, then clear focus" },
  { keys: ["/"], label: "Search celestial bodies" },
  { keys: ["?"], label: "Show keyboard shortcuts" },
];

const TOUCH_HINTS = [
  { label: "One finger drag", desc: "Rotate the view" },
  { label: "Pinch", desc: "Zoom in / out" },
  { label: "Two finger drag", desc: "Pan" },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[28px] items-center justify-center rounded-md border border-white/20 bg-white/10 px-2 py-1 font-mono text-[11px] font-semibold text-white/90 shadow-[0_2px_0_rgba(0,0,0,0.4)]">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcutsModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="relative max-h-[85dvh] w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-gray-950/95 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            aria-label="Close shortcuts"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          <ul className="space-y-3">
            {SHORTCUTS.map((s) => (
              <li key={s.keys.join("+")} className="flex items-center justify-between gap-4">
                <span className="text-xs text-white/60">{s.label}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {s.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
              Touch controls
            </div>
            <ul className="mt-3 space-y-2">
              {TOUCH_HINTS.map((h) => (
                <li key={h.label} className="flex items-center justify-between gap-4">
                  <span className="text-xs text-white/70">{h.label}</span>
                  <span className="text-right text-[11px] text-white/40">{h.desc}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
