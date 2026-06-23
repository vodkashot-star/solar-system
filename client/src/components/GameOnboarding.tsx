import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";

export function GameOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem("cosmicvoyage-onboarding-seen");
    if (!hasSeen) {
      setShowOnboarding(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("cosmicvoyage-onboarding-seen", "true");
    setShowOnboarding(false);
  };

  return (
    <Dialog open={showOnboarding} onOpenChange={setShowOnboarding}>
      <DialogContent className="bg-chart border-brass/30 text-parchment max-w-md">
        <DialogHeader>
          <DialogTitle className="text-brass font-display text-xl">
            Welcome to CosmicVoyage
          </DialogTitle>
          <DialogDescription className="text-parchment/70 pt-2 space-y-3">
            <p>
              Explore a 3D interactive solar system. Orbit around planets,
              discover celestial bodies, and learn about our cosmic neighborhood.
            </p>
            <p className="text-sm text-parchment/50">
              Click on any planet or celestial object to view detailed
              information and fun facts.
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button
            onClick={handleDismiss}
            className="bg-brass text-void hover:bg-brass-light"
          >
            Begin Exploration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
