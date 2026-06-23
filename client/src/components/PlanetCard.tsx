import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Circle } from "lucide-react";
import { useSolarSystem } from "@/lib/stores/useSolarSystem";
import { planetsData } from "@/data/planets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PlanetCard() {
  const { selectedPlanet, setSelectedPlanet, isPlanetDiscovered } = useSolarSystem();
  
  const planet = planetsData.find(p => p.name === selectedPlanet);
  const isDiscovered = selectedPlanet ? isPlanetDiscovered(selectedPlanet) : false;
  const isOpen = !!selectedPlanet && isDiscovered;
  
  useEffect(() => {
    if (!isDiscovered && selectedPlanet) {
      setSelectedPlanet(null);
    }
  }, [isDiscovered, selectedPlanet, setSelectedPlanet]);
  
  if (!planet) return null;
  
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            onClick={() => setSelectedPlanet(null)}
          />
          
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 20 }}
            className="relative pointer-events-auto w-full mx-2 md:mx-4 md:max-w-2xl max-h-[85vh] flex flex-col"
          >
            <Card className="bg-chart/90 backdrop-blur-md flex flex-col flex-1 overflow-hidden">
              <CardHeader className="border-b border-brass/10 flex-shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-1 md:gap-2 text-parchment text-lg md:text-2xl flex-1 min-w-0 font-display">
                    <Circle 
                      className="w-4 h-4 md:w-6 md:h-6 flex-shrink-0" 
                      style={{ color: planet.color }}
                      fill={planet.color}
                    />
                    <span className="truncate">{planet.name}</span>
                    <span className="ml-1 md:ml-2 px-1.5 md:px-2 py-0.5 text-xs bg-brass/20 text-brass-light rounded-full flex-shrink-0">
                      +{planet.tokenReward} STAR
                    </span>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedPlanet(null)}
                    className="text-white/70 hover:text-white hover:bg-white/10 flex-shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="p-3 md:p-6 overflow-y-auto flex-1">
                <div className="flex items-center gap-1 md:gap-2 mb-2 md:mb-4 text-star text-sm md:text-base">
                  <Sparkles className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                  <span className="font-display">+{planet.tokenReward} STAR earned</span>
                </div>
                
                <p className="text-parchment/80 text-xs md:text-sm mb-3 md:mb-4">
                  {planet.facts.description}
                </p>
                
                <div className="grid grid-cols-2 gap-2 md:gap-4 text-xs md:text-sm">
                  <div className="bg-void-lighter/60 rounded-lg p-2 md:p-3">
                    <div className="text-parchment/50 text-xs mb-0.5">Diameter</div>
                    <div className="text-parchment font-display text-xs md:text-sm">{planet.facts.diameter}</div>
                  </div>
                  
                  <div className="bg-void-lighter/60 rounded-lg p-2 md:p-3">
                    <div className="text-parchment/50 text-xs mb-0.5">Distance from Sun</div>
                    <div className="text-parchment font-display text-xs md:text-sm">{planet.facts.distanceFromSun}</div>
                  </div>
                  
                  <div className="bg-void-lighter/60 rounded-lg p-2 md:p-3">
                    <div className="text-parchment/50 text-xs mb-0.5">Orbital Period</div>
                    <div className="text-parchment font-display text-xs md:text-sm">{planet.facts.orbitalPeriod}</div>
                  </div>
                  
                  <div className="bg-void-lighter/60 rounded-lg p-2 md:p-3">
                    <div className="text-parchment/50 text-xs mb-0.5">Day Length</div>
                    <div className="text-parchment font-display text-xs md:text-sm">{planet.facts.dayLength}</div>
                  </div>
                  
                  <div className="bg-void-lighter/60 rounded-lg p-2 md:p-3 col-span-2">
                    <div className="text-parchment/50 text-xs mb-0.5">Moons</div>
                    <div className="text-parchment font-display text-xs md:text-sm">{planet.facts.moons}</div>
                  </div>
                </div>
                
                <div className="mt-2 md:mt-3 bg-nebula/10 border border-nebula/20 rounded-lg p-2 md:p-3">
                  <div className="text-nebula font-display mb-1 text-xs md:text-sm">Fun Fact</div>
                  <div className="text-parchment/80 text-xs md:text-sm line-clamp-2 md:line-clamp-none">{planet.facts.funFact}</div>
                </div>


              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
