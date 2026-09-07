import { splitUncertaintyFlags } from '../../lib/format.js';
import { FlagIcon, AlertTriangleIcon, AlertCircleIcon, InfoIcon } from '../icons/Icon.jsx';
import './EvidencePanel.css';

/**
 * GROUP 2 (pairs with EvidenceComparison) - owns this file + EvidencePanel.css only.
 *
 * ARCHITECTURE NOTE - deviation from docs/tasks/06-react-frontend.md:
 * the doc describes 4 dimension cards (Customer/Pincode/Courier/Lane)
 * each with rto_rate_7d/30d/90d, trend, sample size and a data_quality
 * STALE/MISSING badge. The verified InvestigationReport contract
 * (src/investigation_agent.py) does NOT expose any such structured,
 * per-dimension object - supporting_evidence/counter_evidence/
 * uncertainty_flags are flat string[] (evidence codes / short phrases),
 * there is no rto_rate_7d/30d/90d, trend, or sample_size per
 * investigation. That breakdown is not available over the wire, so it
 * cannot be rendered without fabricating it.
 *
 * Built against the real contract instead, with a two-tier severity
 * split inside `uncertainty_flags` itself. Confirmed by reading
 * src/decision_engine.py (backend, `compute_uncertainty_flags`):
 * every flag sourced from `data_quality.issues` is emitted with a
 * hardcoded `"CRITICAL: {issue}"` prefix; every other flag (small
 * courier×pincode sample, thin customer history, no historical
 * precedent) is a plain phrase with no such prefix. That prefix is
 * the only reliable discriminator the wire format gives us, so it is
 * used here to split flags into a CRITICAL tier (solid, danger-toned,
 * listed first) and a WARNING tier (softer, warning-toned) rather
 * than rendering one undifferentiated bag of strings. `advisory_flag`
 * (a separate, nullable field the narrative step may set - unrelated
 * to uncertainty_flags) is surfaced as its own callout above both
 * tiers.
 *
 * This panel intentionally does NOT try to be "the one thing visible
 * without scrolling" for critical flags - that tension (raised by the
 * UX spec) is resolved at the DecisionBanner level (a different
 * group's file), which gets its own always-visible summary bar for
 * CRITICAL flags. This panel is the full, scrollable detail view: it
 * always renders every flag, in both tiers, for anyone who scrolls to
 * it.
 *
 * States covered: no investigation yet (defensive - App.jsx only ever
 * mounts this with a real report, but the component doesn't assume
 * that), fully empty (no flags, no advisory), and populated (either or
 * both tiers, with or without an advisory).
 *
 * @param {{ investigation: import('../../types').InvestigationReport | null | undefined }} props
 */
export default function EvidencePanel({ investigation }) {
  if (!investigation) {
    return (
      <div className="tab-section evidence-panel">
        <h2 className="panel-title">
          <span className="panel-title__icon">
            <FlagIcon />
          </span>
          Evidence quality
        </h2>
        <p className="empty-state">No investigation selected yet.</p>
      </div>
    );
  }

  const { uncertainty_flags: uncertaintyFlags = [], advisory_flag: advisoryFlag } = investigation;

  const { critical: criticalFlags, warning: warningFlags } = splitUncertaintyFlags(uncertaintyFlags);
  const hasAnyFlags = criticalFlags.length > 0 || warningFlags.length > 0;

  return (
    <div className="tab-section evidence-panel">
      <h2 className="panel-title">
        <span className="panel-title__icon">
          <FlagIcon />
        </span>
        Evidence quality
      </h2>

      {advisoryFlag && (
        <p className="evidence-panel__advisory">
          <InfoIcon />
          <span>{advisoryFlag}</span>
        </p>
      )}

      {!hasAnyFlags && !advisoryFlag && (
        <p className="empty-state">No uncertainty flags - evidence is sufficient for an automated decision.</p>
      )}

      {criticalFlags.length > 0 && (
        <div className="evidence-panel__tier evidence-panel__tier--critical">
          <h3>Critical ({criticalFlags.length})</h3>
          <ul className="evidence-panel__flags evidence-panel__flags--critical">
            {criticalFlags.map((flag) => (
              <li key={flag}>
                <AlertTriangleIcon />
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {warningFlags.length > 0 && (
        <div className="evidence-panel__tier evidence-panel__tier--warning">
          <h3>Warnings ({warningFlags.length})</h3>
          <ul className="evidence-panel__flags evidence-panel__flags--warning">
            {warningFlags.map((flag) => (
              <li key={flag}>
                <AlertCircleIcon />
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
