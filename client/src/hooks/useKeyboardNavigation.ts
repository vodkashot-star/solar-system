import { useEffect } from "react";
import type { Body } from "@/components/solar-system/bodies";

type Options = {
  /** The full body list (static catalog + custom bodies). */
  bodies: Body[];
  /** Index of the currently active body in the bodies array. */
  currentIndex: number;
  /** Whether the detail modal is open (Escape closes it first). */
  detailOpen: boolean;
  /** Whether the search panel is open (Escape closes it first). */
  searchOpen: boolean;
  /** Whether the keyboard shortcuts modal is open (suppresses all other shortcuts). */
  shortcutsOpen: boolean;
  onToggleTour: () => void;
  onPrevBody: (bodyId: string) => void;
  onNextBody: (bodyId: string) => void;
  onClearFocus: () => void;
  onCloseDetail: () => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onOpenShortcuts: () => void;
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
 *  ?          — open keyboard shortcuts modal
 *
 * Input and textarea elements are excluded so typing is never interrupted.
 * While the shortcuts modal is open, all shortcuts except Escape are suppressed
 * (so Space doesn't toggle the tour while reading the modal).
 */
export function useKeyboardNavigation({
  bodies,
  currentIndex,
  detailOpen,
  searchOpen,
  shortcutsOpen,
  onToggleTour,
  onPrevBody,
  onNextBody,
  onClearFocus,
  onCloseDetail,
  onOpenSearch,
  onCloseSearch,
  onOpenShortcuts,
}: Options): void {
  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (shortcutsOpen) {
        // The modal registers its own Escape listener — suppress everything else
        // so Space/arrows don't trigger scene actions while it's open.
        return;
      }

      switch (e.key) {
        case " ": {
          e.preventDefault();
          onToggleTour();
          break;
        }
        case "ArrowLeft": {
          const prev = bodies[(currentIndex - 1 + bodies.length) % bodies.length];
          onPrevBody(prev.id);
          break;
        }
        case "ArrowRight": {
          const next = bodies[(currentIndex + 1) % bodies.length];
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
        case "?": {
          e.preventDefault();
          onOpenShortcuts();
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    bodies,
    currentIndex,
    detailOpen,
    searchOpen,
    shortcutsOpen,
    onToggleTour,
    onPrevBody,
    onNextBody,
    onClearFocus,
    onCloseDetail,
    onOpenSearch,
    onCloseSearch,
    onOpenShortcuts,
  ]);
}
