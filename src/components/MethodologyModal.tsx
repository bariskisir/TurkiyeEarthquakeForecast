/**
 * @fileoverview Defines the methodology modal dashboard UI module, separating typed rendering and browser interaction from unrelated server and model concerns.
 */
"use client";

import { Fragment, useEffect, useRef } from "react";
import { copy, methodologyCopy, type Locale } from "@/lib/i18n";

/**
 * Renders the rich text React component as part of the methodology modal dashboard UI module, using typed inputs and localized accessible output.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function RichText({ children }: { children: string }) {
  return children.split("<br />").map((line, lineIndex) => (
    <Fragment key={`line-${lineIndex}`}>
      {lineIndex > 0 && <br />}
      {line.split(/(<strong>.*?<\/strong>)/g).filter(Boolean).map((part, partIndex) => part.startsWith("<strong>") ? <strong key={partIndex}>{part.slice(8, -9)}</strong> : <Fragment key={partIndex}>{part}</Fragment>)}
    </Fragment>
  ));
}

/**
 * Renders the methodology modal React component as part of the methodology modal dashboard UI module, using typed inputs and localized accessible output.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export default function MethodologyModal({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const t = methodologyCopy[locale];
  const ui = copy[locale];
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    /**
     * Performs the handle key down operation for the methodology modal dashboard UI module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
     *
     * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])")).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialog} className="modal-content" role="dialog" aria-modal="true" aria-labelledby="methodology-title">
        <div className="modal-header">
          <h2 id="methodology-title">{ui.methodologyModalTitle}</h2>
          <button ref={closeButton} type="button" className="modal-close" onClick={onClose} aria-label={ui.methodologyClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p><RichText>{t.intro}</RichText></p>

          <h3>{t.methodsTitle}</h3>
          <table className="param-table"><thead><tr><th>{t.methodsHeaderMethod}</th><th>{t.methodsHeaderExplanation}</th></tr></thead><tbody>
            <tr><td><strong>{ui.combinedMethod}</strong></td><td>{t.methodsCombined}</td></tr>
            <tr><td><strong>{ui.poissonMethod}</strong></td><td>{t.methodsPoisson}</td></tr>
            <tr><td><strong>{ui.etasMethod}</strong></td><td>{t.methodsEtas}</td></tr>
            <tr><td><strong>{ui.triggeredMethod}</strong></td><td>{t.methodsTriggered}</td></tr>
            <tr><td><strong>{ui.bValueMethod}</strong></td><td>{t.methodsBValue}</td></tr>
            <tr><td><strong>{ui.naturalTimeMethod}</strong></td><td>{t.methodsNaturalTime}</td></tr>
            <tr><td><strong>{ui.energyMethod}</strong></td><td>{t.methodsEnergy}</td></tr>
            <tr><td><strong>{ui.clusteringMethod}</strong></td><td>{t.methodsClustering}</td></tr>
            <tr><td><strong>{ui.recurrenceMethod}</strong></td><td>{t.methodsRecurrence}</td></tr>
          </tbody></table>
          <p>{t.methodsMagnitudeNote}</p>

          <h3>{t.s1Title}</h3>
          <pre className="math-block">{t.s1Formula}</pre>
          <table className="param-table"><tbody>
            <tr><td><code>μ(x, y)</code></td><td>{t.s1Mu}</td></tr>
            <tr><td><code>k(M_i)</code></td><td>{t.s1K}</td></tr>
            <tr><td><code>g(Δt)</code></td><td>{t.s1G}</td></tr>
            <tr><td><code>f(r, M)</code></td><td>{t.s1F}</td></tr>
          </tbody></table>

          <h3>{t.s2Title}</h3><p>{t.s2Text}</p>
          <h3>{t.s3Title}</h3><pre className="math-block">{t.s3Formula}</pre><p>{t.s3Text}</p>
          <h3>{t.s4Title}</h3><pre className="math-block">{t.s4Formula1}</pre><p><RichText>{t.s4Text}</RichText></p><pre className="math-block">{t.s4Formula2}</pre>
          <h3>{t.s5Title}</h3><pre className="math-block">{t.s5Formula}</pre><p>{t.s5Text}</p>
          <h3>{t.s6Title}</h3><pre className="math-block">{t.s6Formula}</pre><p>{t.s6Text}</p>
          <h3>{t.s7Title}</h3>
          <pre className="math-block">{t.s7Formula0}</pre>
          <p><strong>{t.s7Utsu}</strong></p><pre className="math-block">{t.s7Formula1}</pre><p>{t.s7Text1}</p>
          <p><strong>{t.s7Omori}</strong></p><pre className="math-block">{t.s7Formula2}</pre>
          <p><strong>{t.s7Spatial}</strong></p><pre className="math-block">{t.s7Formula3}</pre><p>{t.s7Text2}</p>

          <h3>{t.s8Title}</h3><p>{t.s8Intro}</p>
          <p><strong>{t.s8CvTitle}</strong></p><pre className="math-block">{t.s8CvFormula}</pre>
          <p><strong>{t.s8EnergyTitle}</strong></p><pre className="math-block">{t.s8EnergyFormula}</pre><p>{t.s8EnergyText}</p>
          <p><strong>{t.s8NtTitle}</strong></p><pre className="math-block">{t.s8NtFormula}</pre><p>{t.s8NtText}</p>
          <p><strong>{t.s8ZTitle}</strong></p><pre className="math-block">{t.s8ZFormula}</pre><p>{t.s8ZText}</p>
          <p><strong>{t.s8DeficitTitle}</strong></p><pre className="math-block">{t.s8DeficitFormula}</pre>

          <h3>{t.s9Title}</h3><pre className="math-block">{t.s9Formula}</pre><p>{t.s9Text}</p>
          <h3>{t.s9bTitle}</h3><pre className="math-block">{t.s9bFormula}</pre><p>{t.s9bText}</p>
          <h3>{t.s10Title}</h3><pre className="math-block">{t.s10Formula}</pre>
          <p><strong>{t.s10TableTitle}</strong></p>
          <table className="param-table"><thead><tr><th>{t.s10TableHeaderW}</th><th>{t.s10TableHeaderM5}</th><th>{t.s10TableHeaderM6}</th><th>{t.s10TableHeaderM7}</th><th>{t.s10TableHeaderMeaning}</th></tr></thead><tbody>
            <tr><td><code>w_b</code></td><td>0.03</td><td>0.07</td><td><strong>0.14</strong></td><td>{t.s10BValueMeaning}</td></tr>
            <tr><td><code>w_nt</code></td><td>0.05</td><td>0.09</td><td><strong>0.14</strong></td><td>{t.s10NtMeaning}</td></tr>
            <tr><td><code>w_en</code></td><td>0.04</td><td>0.06</td><td><strong>0.10</strong></td><td>{t.s10EnMeaning}</td></tr>
            <tr><td><code>w_cv</code></td><td><strong>0.12</strong></td><td>0.06</td><td>0.02</td><td>{t.s10CvMeaning}</td></tr>
            <tr><td><code>w_rec</code></td><td>0</td><td><strong>0.50</strong></td><td><strong>1.00</strong></td><td>{t.s10RecurrenceMeaning}</td></tr>
          </tbody></table>
          <p><strong>{t.s10FeasibilityTitle}</strong></p><pre className="math-block">{t.s10Feasibility}</pre><p><RichText>{t.s10Text}</RichText></p>
          <h3>{t.s11Title}</h3><p><RichText>{t.s11Text}</RichText></p>
          <h3>{t.s12Title}</h3>
          <table className="param-table"><thead><tr><th>{ui.score}</th><th>{ui.level}</th></tr></thead><tbody>
            <tr><td>≥ 92</td><td>{t.s12VeryHigh}</td></tr>
            <tr><td>≥ 80</td><td>{t.s12High}</td></tr>
            <tr><td>≥ 65</td><td>{t.s12Notable}</td></tr>
            <tr><td>&lt; 65</td><td>{t.s12Elevated}</td></tr>
          </tbody></table>
          <p className="modal-disclaimer"><strong>{t.disclaimer}</strong></p>
        </div>
      </div>
    </div>
  );
}
