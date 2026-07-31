import { useEffect } from "react";
import { BODIES } from "@/components/solar-system/bodies";

type Options = {
  /** Index of the currently active body in the BODIES array. */
  currentIndex: number;
  /** Whether the detail modal is open (Escape closes it first). */
  detailOpen: boolean;
  /** Whether the search panel is open (Escape closes it first). */
  searchOpen: boolean;
  onToggleTour: () => void;
  onPrevBody: (bodyId: string) => void;
  onNextBody: (bodyId: string) => void;
  onClearFocus: () => void;
  onCloseDetail: () => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
};

/**
 * Registers global keyboard shortcuts for solar-system navigation.
 *
 * Shortcuts:
 *  Space      — toggle cinematic tour
 *  ArrowLeft  — focus previous body
 *  ArrowRight — focus next body
 *  Escape     — close detail modal → close search → clear camera focus
 *  /          — open body search
 *
 * Input and textarea elements are excluded so typing is never interrupted.
 */
export function useKeyboardNavigation({
  currentIndex,
  detailOpen,
  searchOpen,
  onToggleTour,
  onPrevBody,
  onNextBody,
  onClearFocus,
  onCloseDetail,
  onOpenSearch,
  onCloseSearch,
}: Options): void {
  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case " ": {
          e.preventDefault();
          onToggleTour();
          break;
        }
        case "ArrowLeft": {
          const prev = BODIES[(currentIndex - 1 + BODIES.length) % BODIES.length];
          onPrevBody(prev.id);
          break;
        }
        case "ArrowRight": {
          const next = BODIES[(currentIndex + 1) % BODIES.length];
          onNextBody(next.id);
          break;
        }
        case "Escape": {
          // Layered dismiss: detail → search → camera focus
          if (detailOpen) { onCloseDetail(); return; }
          if (searchOpen) { onCloseSearch(); return; }
          onClearFocus();
          break;
        }
        case "/": {
          e.preventDefault();
          onOpenSearch();
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    currentIndex,
    detailOpen,
    searchOpen,
    onToggleTour,
    onPrevBody,
    onNextBody,
    onClearFocus,
    onCloseDetail,
    onOpenSearch,
    onCloseSearch,
  ]);
}
