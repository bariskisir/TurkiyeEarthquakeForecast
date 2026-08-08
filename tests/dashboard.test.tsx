/**
 * @fileoverview Defines the dashboard.test Vitest specification, documenting expected success, failure, edge-case, and regression behavior without modifying immutable catalogue data.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Dashboard from "@/components/Dashboard";
import { createForecastResponse } from "./fixtures/forecast";

vi.mock("next/dynamic", () => {
  /**
   * Replaces the client-only Leaflet tree with a deterministic DOM marker so dashboard tests exercise controller behavior without browser map APIs.
   *
   * The named component keeps the dynamic-import contract intact while avoiding network tiles, layout observers, and canvas dependencies in jsdom.
   */
  function MapStub() { return <div data-testid="forecast-map" />; }
  /**
   * Returns the stable map stub from the mocked dynamic loader, matching the component factory contract expected by Next.js.
   *
   * Naming the factory keeps the mock's only function explicit and documented for future test maintenance.
   */
  function dynamicStub() { return MapStub; }
  return { default: dynamicStub };
});

const browserDay = vi.hoisted(() => ({ value: "2026-08-08" }));

vi.mock("@/lib/time", async (importOriginal) => {
  /**
   * Keeps the real calendar-key helpers but pins the client clock so tests can simulate a browser whose day differs from the server's.
   *
   * The hoisted mutable holder lets each test select the simulated browser day before rendering.
   */
  const actual = await importOriginal<typeof import("@/lib/time")>();
  return { ...actual, turkiyeDay: () => browserDay.value };
});

describe("dashboard", () => {
  beforeEach(() => {
    browserDay.value = "2026-08-08";
    window.localStorage.clear();
    window.localStorage.setItem("locale", "en");
    /**
     * Returns a fresh runtime-valid forecast response for each mocked browser request to prevent cross-test object mutation.
     *
     * The named reader mirrors the asynchronous Response.json contract used by the production request hook.
     */
    async function readValidForecast() { return createForecastResponse(); }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: readValidForecast }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.setAttribute("data-bs-theme", "dark");
    document.body.style.overflow = "";
  });

  test("loads validated data and persists locale and theme preferences", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    expect(await screen.findByText("Marmara Sea")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Theme: Dark" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(document.documentElement).toHaveAttribute("data-bs-theme", "light");
    expect(window.localStorage.getItem("theme")).toBe("light");
    await user.click(screen.getByRole("button", { name: "Language: English" }));
    expect(await screen.findByText("Türkiye Deprem")).toBeInTheDocument();
    expect(window.localStorage.getItem("locale")).toBe("tr");
  });

  test("enforces method constraints through the reducer", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    const method = await screen.findByLabelText("Method");
    await user.selectOptions(method, "recurrence");
    expect(method).toHaveValue("recurrence");
    await user.click(within(screen.getByRole("region", { name: "Forecast controls" })).getByRole("button", { name: "M5+" }));
    expect(method).toHaveValue("combined");
  });

  test("traps modal focus, closes on Escape, and restores the trigger", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    const trigger = await screen.findByRole("button", { name: "See how it works" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "How the Forecast Works" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test("opens the footer privacy notice with localStorage details and restores focus", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    const trigger = await screen.findByRole("button", { name: "Privacy Policy" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Privacy Notice & KVKK Disclosure" });
    expect(dialog).toHaveTextContent("Language (`locale`), theme (`theme`), dismissed-warning status (`disclaimer-dismissed`), and the last map center/zoom (`map-view`) are stored only in your browser's localStorage.");
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Privacy Notice & KVKK Disclosure" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test("rejects malformed API payloads without exposing server text", async () => {
    /**
     * Returns a deliberately incomplete API payload that exercises the browser runtime validator's rejection path.
     *
     * The malformed response remains syntactically valid JSON so the test isolates schema validation from parsing failures.
     */
    async function readMalformedForecast() { return { forecasts: {} }; }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: readMalformedForecast }));
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Forecast service is unavailable."));
  });

  test("adopts the server's authoritative day when the browser clock lags", async () => {
    browserDay.value = "2026-08-06";
    const serverDay = "2026-08-08";
    /**
     * Rejects any request carrying the stale browser-computed day and serves the server's authoritative day for bare requests.
     *
     * This mirrors the deployed failure where the app opened with a wrong "today" that the API rejected with a 400.
     */
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(`date=${browserDay.value}`)) {
        return { ok: false, status: 400, json: async () => ({ error: "Unsupported calculation date.", code: "INVALID_REQUEST" }) };
      }
      return { ok: true, json: async () => createForecastResponse({ forecastDayTrt: serverDay }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<Dashboard />);
    const select = await screen.findByLabelText("Snapshot");
    await waitFor(() => expect(select).toHaveValue(serverDay));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(await screen.findByText("Marmara Sea")).toBeInTheDocument();
    expect(fetchMock.mock.calls.every((call) => !String(call[0]).includes(`date=${browserDay.value}`))).toBe(true);
    await user.selectOptions(select, "2000");
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("date=2000"))).toBe(true));
    await user.selectOptions(select, serverDay);
    await waitFor(() => expect(fetchMock.mock.calls.slice(-1)[0] ? !String(fetchMock.mock.calls.slice(-1)[0][0]).includes("date=") : false).toBe(true));
    expect(select).toHaveValue(serverDay);
  });
});
