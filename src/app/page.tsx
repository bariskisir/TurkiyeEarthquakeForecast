/**
 * @fileoverview Defines the Next.js application shell and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import Dashboard from "@/components/Dashboard";

/**
 * Renders the home React component as part of the Next.js application shell, using typed inputs and localized accessible output.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export default function Home() {
  return <Dashboard />;
}
