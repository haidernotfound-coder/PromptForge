"use client";

import { useEffect } from "react";
import { initCloudSync } from "@/lib/store";

/** Fires the Phase 7 cloud-sync bootstrap once the dashboard mounts. Renders
 *  nothing — it's a side-effect-only component so it can sit in the layout
 *  without touching the existing sidebar/header markup. */
export function CloudSyncBoot() {
  useEffect(() => {
    void initCloudSync();
  }, []);
  return null;
}
