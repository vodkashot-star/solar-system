import { useState } from "react";
import type { Body } from "./bodies";
import { AI_ENDPOINTS } from "@/lib/config";
type AIClassificationPanelProps = {
  body: Body;
  className?: string;
  compact?: boolean;
};

const CORRECTION_TYPES = ["Star", "Planet", "DwarfPlanet", "Moon", "Asteroid", "Comet", "Interstellar", "Spacecraft"];

export default function AIClassificationPanel({ body, className = "", compact }: AIClassificationPanelProps) {
  const [showCorrection, setShowCorrection] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [correctionSubmitted, setCorrectionSubmitted] = useState(false);

  if (!body.aiAnalysis) {
    const isSpacecraft = body.type === "spacecraft";
    return (
      <div className={`rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md ${className}`}>
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">AI Analysis</div>
        {isSpacecraft ? (
          <div className="mt-2">
            <div className="text-2xl font-light text-white">Human-made spacecraft</div>
            <p className="mt-1 text-xs text-white/40">
              Live classification unavailable — AI service offline.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-white/60">Waiting for prediction...</p>
        )}
      </div>
    );
  }

  if (compact) {
    const { classification, confidence } = body.aiAnalysis;
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-white">{classification}</span>
        <span className="text-[10px] text-white/50">{(confidence * 100).toFixed(0)}%</span>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500" style={{ width: `${confidence * 100}%` }} />
        </div>
      </div>
    );
  }

  const { classification, confidence, uncertainty, alternatives, features } = body.aiAnalysis;

  const handleSubmitCorrection = async () => {
    try {
      await fetch(AI_ENDPOINTS.correct, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body_id: body.id,
          predicted_type: body.aiAnalysis?.classification ?? "",
          corrected_type: selectedType,
          features: body.aiAnalysis?.features?.map((f) => f.value) ?? [],
          uncertainty: body.aiAnalysis?.uncertainty ?? 0,
        }),
      });
    } catch {
      // Silently fail — AI service may be offline
    }
    setCorrectionSubmitted(true);
  };

  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md ${className}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">AI Classification</div>

      {/* Main classification */}
      <div className="mt-2">
        <div className="flex items-baseline gap-2">
          <div className="text-base font-medium text-white">{classification}</div>
          <div className="text-[10px] text-white/50">{(confidence * 100).toFixed(1)}%</div>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500"
          style={{ width: `${confidence * 100}%` }}
        />
      </div>

      {/* Uncertainty badge */}
      {uncertainty !== undefined && uncertainty > 0.4 && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400">
            Uncertain
          </span>
          <span className="text-[10px] text-amber-400/60">
            {(uncertainty * 100).toFixed(0)}% entropy
          </span>
        </div>
      )}

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Alternative classifications</div>
          <div className="mt-1 space-y-1">
            {alternatives.slice(0, 3).map((alt, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-white/80">{alt.type}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white/50"
                      style={{ width: `${alt.score * 100}%` }}
                    />
                  </div>
                  <span className="text-white/40">{(alt.score * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key features */}
      {features.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Key features</div>
          <div className="mt-1 space-y-1">
            {features.slice(0, 5).map((feature, idx) => (
              <div key={idx} className="flex items-center justify-between text-[10px]">
                <span className="text-white/60 truncate" title={feature.name}>
                  {feature.name}
                </span>
                <span className="text-white/30">
                  {typeof feature.value === "number" ? feature.value.toFixed(2) : feature.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Correction UI */}
      {!correctionSubmitted && (
        <div className="mt-3 border-t border-white/5 pt-3">
          {!showCorrection ? (
            <button
              onClick={() => setShowCorrection(true)}
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30 hover:text-white/60 transition-colors"
            >
              Wrong classification? Correct it
            </button>
          ) : (
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Correct classification
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CORRECTION_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                      selectedType === type
                        ? "bg-white/20 text-white"
                        : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              {selectedType && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSubmitCorrection}
                    className="rounded-md bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-white/20 transition-colors"
                  >
                    Submit correction
                  </button>
                  <button
                    onClick={() => { setShowCorrection(false); setSelectedType(""); }}
                    className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {correctionSubmitted && (
        <div className="mt-3 rounded-md bg-green-500/10 px-2 py-1.5">
          <p className="text-[10px] text-green-400">Correction recorded. Model improves over time.</p>
        </div>
      )}
    </div>
  );
}
