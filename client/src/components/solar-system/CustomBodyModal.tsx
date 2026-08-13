/**
 * CustomBodyModal.tsx
 *
 * Form to create a user-defined celestial body via POST /api/bodies. The new
 * body is fetched back and rendered in the scene by SolarSystem (merged with
 * the static BODIES catalog). Creation fails silently if the API is offline.
 */

import { useState } from "react";
import type { BodyType } from "./bodies";
import { BODY_TYPE_COLORS } from "./bodies";
import { createCustomBody } from "@/lib/custom-bodies";

const BODY_TYPES: BodyType[] = [
  "planet",
  "dwarfPlanet",
  "asteroid",
  "comet",
  "interstellar",
  "star",
  "spacecraft",
];

const TYPE_LABELS: Record<BodyType, string> = {
  star: "Star",
  planet: "Planet",
  dwarfPlanet: "Dwarf planet",
  asteroid: "Asteroid",
  comet: "Comet",
  interstellar: "Interstellar object",
  spacecraft: "Spacecraft",
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (bodyId: string) => void;
};

export default function CustomBodyModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<BodyType>("planet");
  const [color, setColor] = useState("#9e9e9e");
  const [orbit, setOrbit] = useState("20");
  const [orbitSpeed, setOrbitSpeed] = useState("0.08");
  const [visualRadius, setVisualRadius] = useState("1");
  const [fact, setFact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    const created = await createCustomBody({
      name: trimmed,
      type,
      color,
      orbit: parseFloat(orbit) || 20,
      orbitSpeed: parseFloat(orbitSpeed) || 0.08,
      visualRadius: parseFloat(visualRadius) || 1,
      fact: fact.trim() || undefined,
    });
    setSubmitting(false);
    if (created) {
      onCreated(created.id);
      setName("");
      setFact("");
      onClose();
    } else {
      setError("Could not create body — API unreachable?");
    }
  };

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-amber-500/50";
  const labelClass = "text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="max-h-[92vh] w-full sm:w-[min(92vw,420px)] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-2xl border-t border-white/15 sm:border border-white/15 bg-[#0b0d1a]/98 shadow-2xl backdrop-blur-xl">
        {/* Mobile handle indicator */}
        <div className="flex justify-center pt-3 pb-2 sm:hidden">
          <div className="w-12 h-1 rounded-full bg-white/20" />
        </div>
        
        <div className="flex items-center justify-between px-5 pb-4 pt-2 sm:pt-5">
          <h2 className="text-base sm:text-base font-semibold text-white">Add celestial body</h2>
          <button
            onClick={onClose}
            aria-label="Close add-body form"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-lg text-white/40 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-95"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-6 flex flex-col gap-4">
          <div>
            <label className={labelClass} htmlFor="cb-name">Name</label>
            <input
              id="cb-name"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kepler-442b"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass} htmlFor="cb-type">Type</label>
              <select
                id="cb-type"
                className={inputClass}
                value={type}
                onChange={(e) => {
                  const t = e.target.value as BodyType;
                  setType(t);
                  setColor(BODY_TYPE_COLORS[t]);
                }}
              >
                {BODY_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-[#0b0d1a]">
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label className={labelClass} htmlFor="cb-color">Color</label>
              <input
                id="cb-color"
                type="color"
                className="h-[42px] w-full cursor-pointer rounded-lg border border-white/10 bg-white/5"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass} htmlFor="cb-orbit">Orbit radius</label>
              <input
                id="cb-orbit"
                type="number"
                step="0.5"
                className={inputClass}
                value={orbit}
                onChange={(e) => setOrbit(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className={labelClass} htmlFor="cb-speed">Orbit speed</label>
              <input
                id="cb-speed"
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={orbitSpeed}
                onChange={(e) => setOrbitSpeed(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="cb-radius">Visual radius</label>
            <input
              id="cb-radius"
              type="number"
              step="0.1"
              min="0.1"
              className={inputClass}
              value={visualRadius}
              onChange={(e) => setVisualRadius(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="cb-fact">Fact (optional)</label>
            <textarea
              id="cb-fact"
              className={`${inputClass} resize-none`}
              rows={2}
              value={fact}
              onChange={(e) => setFact(e.target.value)}
              placeholder="Short description shown in the HUD"
            />
          </div>

          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-[48px] mt-2 rounded-xl bg-amber-500/95 px-4 py-3 text-sm font-semibold text-black transition-all duration-150 hover:bg-amber-400 active:scale-95 disabled:opacity-50 shadow-lg"
          >
            {submitting ? "Adding…" : "Add to system"}
          </button>
        </form>
      </div>
    </div>
  );
}
