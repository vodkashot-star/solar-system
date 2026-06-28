import { Body } from "./bodies";

type AIClassificationPanelProps = {
  body: Body;
  className?: string;
};

export default function AIClassificationPanel({ body, className = "" }: AIClassificationPanelProps) {
  if (!body.aiAnalysis) {
    return (
      <div className={`rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md ${className}`}>
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">AI Analysis</div>
        <p className="mt-2 text-sm text-white/60">Waiting for prediction...</p>
      </div>
    );
  }

  const { classification, confidence, alternatives, features } = body.aiAnalysis;

  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md ${className}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">AI Classification</div>

      {/* Main classification */}
      <div className="mt-2">
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-light text-white">{classification}</div>
          <div className="text-xs text-white/50">{(confidence * 100).toFixed(1)}% confidence</div>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500"
          style={{ width: `${confidence * 100}%` }}
        />
      </div>

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
    </div>
  );
}
