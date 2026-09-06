import { decisionColor, riskColor, formatPercent, splitUncertaintyFlags } from '../../lib/format.js';
import './DecisionBanner.css';

/**
 * GROUP 4 — owns this file + DecisionBanner.css only.
 *
 * The one thing visible without scrolling: `decision` (color-coded via
 * the shared decisionColor() helper), `risk_level` (riskColor()),
 * `confidence`, `reason`, plus (when present) the named demo `scenario`
 * this order was built for, and — for any non-RELEASE call — a plain
 * signal that the order has been handed off to a human ops reviewer
 * (naming the escalation ticket when one was actually written).
 *
 * EXTENDED per the UX spec's resolution of a real tension: the task
 * doc wants a fabricated 4-dimension STALE/MISSING data-quality grid
 * that isn't in the wire contract (see EvidencePanel's note — that
 * structured object was never in InvestigationReport and the backend's
 * real STALE-detection warnings are computed but dropped before the
 * API response), while a separate instruction wants data-quality
 * problems to be "the single most important visual element on the
 * page, not a minor badge" — in tension with this component being "the
 * one thing visible without scrolling." Rather than fabricate numbers
 * or move data-quality out of this always-visible component, any
 * `uncertainty_flags` entry carrying the real "CRITICAL: " prefix (the
 * one reliable discriminator the backend actually emits, from
 * decision_engine.compute_uncertainty_flags) gets a full-width,
 * solid-color alert bar rendered INSIDE this component, above the
 * decision line itself, so it can't be missed without scrolling. The
 * complete, undifferentiated flag list (critical + warning tier) stays
 * owned by EvidencePanel for anyone who scrolls further — this
 * component surfaces only the critical subset plus a count of any
 * remaining flags pointing there, it does not duplicate that detail.
 *
 * States handled (pure/props-driven — no fetch of its own, so no
 * network loading/error state applies; "as applicable" per the async
 * quality bar means the states that actually apply here):
 *  - no `investigation` prop at all -> renders nothing (defensive; the
 *    real caller only mounts this once currentInvestigation is set,
 *    but this file must stand alone with no dependency on that caller)
 *  - populated, zero uncertainty_flags -> plain banner, no alert bar
 *  - populated, only non-critical (no "CRITICAL: " prefix) flags ->
 *    plain banner + a small note pointing at Evidence quality below
 *  - populated, one or more "CRITICAL: " flags -> full-width solid
 *    alert bar listing them, on top of the plain banner content
 *  - missing/null confidence, reason, risk_level, decision -> safe
 *    fallbacks ("—", "UNKNOWN", a default sentence), never renders
 *    "NaN%" or a bare "undefined"
 *
 * @param {{ investigation: import('../../types').InvestigationReport | null | undefined }} props
 */
export default function DecisionBanner({ investigation }) {
  if (!investigation) return null;

  const {
    decision,
    risk_level: riskLevel,
    confidence,
    reason,
    scenario,
    ticket_id: ticketId,
    uncertainty_flags: uncertaintyFlags = [],
  } = investigation;

  const { critical: criticalFlags, warning: warningFlags } = splitUncertaintyFlags(uncertaintyFlags);
  const warningCount = warningFlags.length;

  return (
    <div
      className="panel decision-banner"
      style={{ borderLeft: `6px solid ${decisionColor(decision)}` }}
    >
      {criticalFlags.length > 0 && (
        <div className="decision-banner__critical-alert" role="alert">
          <span className="decision-banner__critical-icon" aria-hidden="true">
            ⚠
          </span>
          <div className="decision-banner__critical-body">
            <span className="decision-banner__critical-title">
              {criticalFlags.length === 1
                ? 'Critical data quality issue'
                : `${criticalFlags.length} critical data quality issues`}
            </span>
            <ul className="decision-banner__critical-list">
              {criticalFlags.map((flag, index) => (
                <li key={`${flag}-${index}`}>{flag}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="decision-banner__top">
        <span className="decision-banner__decision" style={{ color: decisionColor(decision) }}>
          {decision || 'UNKNOWN'}
        </span>
        <span className="decision-banner__risk" style={{ color: riskColor(riskLevel) }}>
          Risk: {riskLevel || 'UNKNOWN'}
        </span>
        <span className="decision-banner__confidence">Confidence: {formatPercent(confidence)}</span>
        {scenario && scenario !== 'NORMAL' && (
          <span className="decision-banner__scenario">{scenario}</span>
        )}
      </div>

      <p className="decision-banner__reason">{reason || 'No reason provided.'}</p>

      {decision && decision !== 'RELEASE' && (
        <p className="decision-banner__handoff">
          <span aria-hidden="true">→</span> Handed off to a human ops reviewer
          {ticketId ? ` — ticket ${ticketId}` : ''}
        </p>
      )}

      {warningCount > 0 && (
        <p className="decision-banner__warning-note">
          {warningCount === 1
            ? '1 additional data quality flag'
            : `${warningCount} additional data quality flags`}{' '}
          — see Evidence quality below.
        </p>
      )}
    </div>
  );
}
