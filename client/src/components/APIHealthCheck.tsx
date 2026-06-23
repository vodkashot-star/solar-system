
import { useEffect, useState } from "react";
import { checkHealth } from "@/lib/api";
import { Badge } from "./ui/badge";

export function APIHealthCheck() {
  const [status, setStatus] = useState<"checking" | "connected" | "error">("checking");

  useEffect(() => {
    const check = async () => {
      try {
        await checkHealth();
        setStatus("connected");
      } catch (error) {
        console.error("API health check failed:", error);
        setStatus("error");
      }
    };

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  if (status === "checking") return null;

  const isConnected = status === "connected";

  return (
    <div className="fixed top-4 right-4 z-50" role="status" aria-live="polite">
      <Badge variant={isConnected ? "default" : "destructive"}>
        <span className="sr-only">{isConnected ? "API connected" : "API error"}</span>
        <span aria-hidden="true" className="mr-1">{isConnected ? "🟢" : "🔴"}</span>
        {isConnected ? "API Connected" : "API Error"}
      </Badge>
    </div>
  );
}
