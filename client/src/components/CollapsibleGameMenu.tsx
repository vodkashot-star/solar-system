import { useState } from "react";
import { ChevronRight, ChevronLeft, Info } from "lucide-react";

export function CollapsibleGameMenu({ position = "right" }: { position?: "left" | "right" }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`fixed top-0 ${position === "right" ? "right-0" : "left-0"} h-screen flex z-40`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center w-10 h-10 ${
          position === "right" ? "rounded-l-lg" : "rounded-r-lg"
        } bg-void-lighter/80 border border-brass/20 hover:border-brass/50 transition-all backdrop-blur-sm ${
          isOpen ? "opacity-60" : "opacity-100"
        }`}
        title={isOpen ? "Close menu" : "Open menu"}
        aria-label={isOpen ? "Close side panel" : "Open side panel"}
      >
        {isOpen ? (
          position === "right" ? (
            <ChevronRight size={18} className="text-brass" />
          ) : (
            <ChevronLeft size={18} className="text-brass" />
          )
        ) : (
          <ChevronLeft size={18} className="text-brass" />
        )}
      </button>

      {isOpen && (
        <div className="w-72 bg-void-lighter/90 backdrop-blur-md border-l border-brass/20 h-full overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-brass font-display text-sm border-b border-brass/10 pb-3">
              <Info size={16} />
              <span>CosmicVoyage Atlas</span>
            </div>
            <p className="text-parchment/60 text-xs leading-relaxed">
              Explore the solar system. Discover planets, learn about celestial
              bodies, and navigate the cosmos.
            </p>
            <div className="text-parchment/40 text-xs pt-2 border-t border-brass/10">
              <p>Use mouse/touch to orbit the view.</p>
              <p>Click on a celestial body to learn more.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
