export type LoadStatus = {
  bodyId: string;
  bodyName: string;
  url: string;
  status: "loading" | "loaded" | "error";
  startTime: number;
  endTime?: number;
  error?: string;
};

type Listener = () => void;

const statuses = new Map<string, LoadStatus>();
let cached: LoadStatus[] = [];
const listeners = new Set<Listener>();

function emit(): void {
  cached = Array.from(statuses.values());
  listeners.forEach((l) => l());
}

export function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getSnapshot(): LoadStatus[] {
  return cached;
}

export function startLoad(bodyId: string, bodyName: string, url: string): void {
  if (statuses.has(bodyId)) return;
  statuses.set(bodyId, {
    bodyId,
    bodyName,
    url,
    status: "loading",
    startTime: performance.now(),
  });
  emit();
}

export function finishLoad(bodyId: string): void {
  const s = statuses.get(bodyId);
  if (s && s.status === "loading") {
    s.status = "loaded";
    s.endTime = performance.now();
    emit();
  }
}

export function failLoad(bodyId: string, error: string): void {
  const s = statuses.get(bodyId);
  if (s) {
    s.status = "error";
    s.endTime = performance.now();
    s.error = error;
    emit();
  }
}
