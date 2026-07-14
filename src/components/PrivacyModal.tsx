/**
 * @fileoverview Renders the localized privacy and KVKK disclosure in an accessible, focus-managed dashboard modal.
 */
"use client";

import { useEffect, useRef } from "react";
import { copy, type Locale } from "@/lib/i18n";
import { privacyNotice } from "@/lib/privacy-notice";

/**
 * Renders the complete privacy notice, traps keyboard focus, supports Escape and backdrop closing, and restores focus to the footer trigger.
 */
export default function PrivacyModal({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const t = privacyNotice[locale];
  const ui = copy[locale];
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    /**
     * Closes on Escape and cycles Tab focus within the privacy dialog.
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>("button, a[href], [tabindex]:not([tabindex='-1'])")).filter((element) => !element.hasAttribute("disabled"));
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
      <div ref={dialog} className="modal-content privacy-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
        <div className="modal-header">
          <h2 id="privacy-title">{t.pageTitle}</h2>
          <button ref={closeButton} type="button" className="modal-close" onClick={onClose} aria-label={ui.methodologyClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p>{t.pageIntro}</p><p className="privacy-updated">{t.lastUpdated}</p>
          <h3>{t.collectedTitle}</h3><h4>{t.localDataTitle}</h4><p>{t.localDataBody}</p><h4>{t.technicalDataTitle}</h4><p>{t.technicalDataBody}</p>
          <h3>{t.purposesTitle}</h3><p>{t.purposesBody}</p>
          <h3>{t.legalBasisTitle}</h3><p>{t.legalBasisBody}</p>
          <h3>{t.sharingTitle}</h3><p>{t.sharingBody}</p><ul><li><a href="https://sismikharita.com/api" target="_blank" rel="noreferrer">{t.sismikLabel}</a></li><li><a href="https://vercel.com/legal/privacy-notice" target="_blank" rel="noreferrer">{t.vercelLabel}</a></li><li><a href="https://carto.com/privacy/" target="_blank" rel="noreferrer">{t.cartoLabel}</a></li></ul>
          <h3>{t.transfersTitle}</h3><p>{t.transfersBody}</p>
          <h3>{t.retentionTitle}</h3><p>{t.retentionBody}</p>
          <h3>{t.cookiesTitle}</h3><p>{t.cookiesBody}</p>
          <h3>{t.rightsTitle}</h3><p>{t.rightsBody}</p>
          <h3>{t.securityTitle}</h3><p>{t.securityBody}</p>
          <h3>{t.childrenTitle}</h3><p>{t.childrenBody}</p>
          <h3>{t.aiTitle}</h3><p>{t.aiBody}</p>
          <h3>{t.changesTitle}</h3><p>{t.changesBody}</p>
          <p className="modal-disclaimer"><strong>{t.forecastTitle}:</strong> {t.forecastBody}</p>
        </div>
      </div>
    </div>
  );
}
