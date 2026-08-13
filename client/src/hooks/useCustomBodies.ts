/**
 * useCustomBodies.ts
 *
 * Loads user-created bodies from the celestial catalog API and exposes
 * create/remove helpers. Fetches once on mount; `reload` re-fetches after
 * mutations. Fails silently (empty list) so the scene works without a DB.
 */

import { useCallback, useEffect, useState } from "react";
import type { Body } from "@/components/solar-system/bodies";
import {
  fetchCustomBodies,
  createCustomBody,
  deleteCustomBody,
  type CreateCustomBodyInput,
} from "@/lib/custom-bodies";

export function useCustomBodies() {
  const [customBodies, setCustomBodies] = useState<Body[]>([]);

  const reload = useCallback(async () => {
    const bodies = await fetchCustomBodies();
    setCustomBodies(bodies);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCustomBodies().then((bodies) => {
      if (!cancelled) setCustomBodies(bodies);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const create = useCallback(
    async (input: CreateCustomBodyInput) => {
      const created = await createCustomBody(input);
      if (created) await reload();
      return created;
    },
    [reload],
  );

  const remove = useCallback(
    async (bodyId: string) => {
      const ok = await deleteCustomBody(bodyId);
      if (ok) await reload();
      return ok;
    },
    [reload],
  );

  return { customBodies, reload, create, remove };
}
