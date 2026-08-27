/**
 * @fileoverview Fires a single anonymous `app.startup` visit event to Application Insights when the app opens.
 * Client-only: uses `useEffect` so the beacon runs once per page load in the browser.
 */
"use client";

import { useEffect } from "react";
import { trackAppStartup } from "@/lib/telemetry";

/**
 * Renders the anonymous visit tracker that sends one `app.startup` event to Application Insights on mount.
 */
export default function TelemetryTracker() {
  useEffect(() => {
    void trackAppStartup();
  }, []);
  return null;
}
