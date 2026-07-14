/**
 * @fileoverview Defines the Next.js application shell and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import type { Metadata } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "leaflet/dist/leaflet.css";
import "./globals.scss";

export const metadata: Metadata = {
  title: "Türkiye Earthquake Forecast",
  description: "Experimental, data-driven regional earthquake activity forecasts for Türkiye and nearby areas.",
};

/**
 * Renders the root layout React component as part of the Next.js application shell, using typed inputs and localized accessible output.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" data-bs-theme="dark">
      <body>{children}</body>
    </html>
  );
}
