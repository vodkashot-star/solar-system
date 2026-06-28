import { useState } from "react";
import { Body } from "./bodies";
import AIClassificationPanel from "./AIClassificationPanel";

type DataExplorerProps = {
  body: Body;
  className?: string;
};

// Format numbers with appropriate units
function formatValue(value: number, type: string): string {
  switch (type) {
    case "mass":
      return `${value.toFixed(3)} M🜨`;
    case "radius":
      return `${value.toFixed(3)} R🜨`;
    case "density":
      return `${value.toFixed(2)} g/cm³`;
    case "gravity":
      return `${value.toFixed(2)} m/s²`;
    case "temperature":
      return `${value.toFixed(0)} K`;
    case "orbitalPeriod":
      return `${value.toFixed(1)} days`;
    case "semiMajorAxis":
      return `${value.toFixed(2)} AU`;
    case "eccentricity":
      return value.toFixed(3);
    case "inclination":
      return `${value.toFixed(2)}°`;
    case "rotationPeriod":
      return `${Math.abs(value).toFixed(1)} hours`;
    case "axialTilt":
      return `${value.toFixed(2)}°`;
    default:
      return value.toString();
  }
}

function CollapsibleSection({ 
  title, 
  children, 
  defaultOpen = true 
}: { 
  title: string; 
  children: React.ReactNode; 
  defaultOpen?: boolean 
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/60 transition hover:text-white"
      >
        {title}
        <span className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
      </button>
      {isOpen && <div className="py-2">{children}</div>}
    </div>
  );
}

export default function EnhancedDataExplorer({ body, className = "" }: DataExplorerProps) {
  const { properties } = body;

  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md ${className}`}>
      <div className="border-b border-white/10 px-4 py-2">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">Data Explorer</div>
        <div className="text-sm font-medium text-white/80">{body.name}</div>
      </div>

      <div className="p-3">
        {/* Physical Properties */}
        <CollapsibleSection title="Physical Properties" defaultOpen={true}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-white/40">Mass</div>
              <div className="text-white/70">{formatValue(properties.mass, "mass")}</div>
            </div>
            <div>
              <div className="text-white/40">Radius</div>
              <div className="text-white/70">{formatValue(properties.radius, "radius")}</div>
            </div>
            <div>
              <div className="text-white/40">Density</div>
              <div className="text-white/70">{formatValue(properties.density, "density")}</div>
            </div>
            <div>
              <div className="text-white/40">Gravity</div>
              <div className="text-white/70">{formatValue(properties.gravity, "gravity")}</div>
            </div>
            <div>
              <div className="text-white/40">Temp</div>
              <div className="text-white/70">{formatValue(properties.temperature, "temperature")}</div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Orbital Properties */}
        <CollapsibleSection title="Orbital Properties" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-white/40">Orbital Period</div>
              <div className="text-white/70">{formatValue(properties.orbitalPeriod, "orbitalPeriod")}</div>
            </div>
            <div>
              <div className="text-white/40">Semi-Major Axis</div>
              <div className="text-white/70">{formatValue(properties.semiMajorAxis, "semiMajorAxis")}</div>
            </div>
            <div>
              <div className="text-white/40">Eccentricity</div>
              <div className="text-white/70">{formatValue(properties.eccentricity, "eccentricity")}</div>
            </div>
            <div>
              <div className="text-white/40">Inclination</div>
              <div className="text-white/70">{formatValue(properties.inclination, "inclination")}</div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Rotation Properties */}
        <CollapsibleSection title="Rotation Properties" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-white/40">Rotation Period</div>
              <div className="text-white/70">{formatValue(properties.rotationPeriod, "rotationPeriod")}</div>
            </div>
            <div>
              <div className="text-white/40">Axial Tilt</div>
              <div className="text-white/70">{formatValue(properties.axialTilt, "axialTilt")}</div>
            </div>
          </div>
        </CollapsibleSection>

        {/* AI Analysis */}
        <CollapsibleSection title="AI Analysis" defaultOpen={false}>
          <AIClassificationPanel body={body} className="!border-0 !bg-transparent !p-0 !backdrop-blur-none" />
        </CollapsibleSection>
      </div>
    </div>
  );
}
