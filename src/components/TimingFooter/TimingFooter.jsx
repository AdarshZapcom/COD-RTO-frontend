import { formatMs } from '../../lib/format.js';
import './TimingFooter.css';

const STAGES = [
  { key: 'evidence_ms', label: 'Evidence' },
  { key: 'decision_ms', label: 'Decision' },
  { key: 'retrieval_ms', label: 'Retrieval' },
  { key: 'narrative_ms', label: 'Narrative' },
];

/**
 * GROUP 4 (pairs with DecisionBanner) — owns this file + TimingFooter.css only.
 *
 * `timing_ms` breakdown from the report (evidence / decision /
 * retrieval / narrative) — cheap to show, reinforces engineering
 * quality live. Adds a proportional stacked bar under the numeric row
 * (a single-hue ramp on the existing --color-accent token, one shade
 * per stage — deliberately not a new qualitative palette or the
 * decision/risk semantic colors, which would misleadingly imply a
 * stage is "good" or "bad") so the breakdown reads at a glance instead
 * of as four raw numbers side by side.
 *
 * States handled (pure/props-driven — no fetch of its own):
 *  - no `investigation` prop -> renders nothing (defensive; this file
 *    has no dependency on how/when the real caller mounts it)
 *  - `timing_ms` missing, or present but every stage is null/non-numeric
 *    -> "No timing data" empty state, no numeric row, no bar
 *  - partial data (some stages null/non-numeric) -> those stages show
 *    "—" in the numeric row and are simply excluded from the bar
 *    (excluded from its total too, so the remaining segments still
 *    sum to a full bar instead of leaving unexplained empty space)
 *  - fully populated -> numeric row + total + proportional bar
 *
 * @param {{ investigation: import('../../types').InvestigationReport | null | undefined }} props
 */
export default function TimingFooter({ investigation }) {
  if (!investigation) return null;

  const timing = investigation.timing_ms || {};
  const stages = STAGES.map((stage) => {
    const raw = timing[stage.key];
    const value = typeof raw === 'number' && !Number.isNaN(raw) ? raw : null;
    return { ...stage, value };
  });

  const hasAnyValue = stages.some((stage) => stage.value !== null);
  const total = stages.reduce((sum, stage) => sum + (stage.value || 0), 0);

  return (
    <div className="panel timing-footer">
      <h2>Timing</h2>

      {!hasAnyValue ? (
        <p className="empty-state">No timing data for this investigation.</p>
      ) : (
        <>
          <div className="timing-footer__row">
            {stages.map((stage) => (
              <span key={stage.key}>
                {stage.label}: {formatMs(stage.value)}
              </span>
            ))}
            <span className="timing-footer__total">Total: {formatMs(total || null)}</span>
          </div>

          {total > 0 && (
            <div className="timing-footer__bar" aria-hidden="true">
              {stages.map(
                (stage) =>
                  stage.value !== null &&
                  stage.value > 0 && (
                    <span
                      key={stage.key}
                      className={`timing-footer__segment timing-footer__segment--${stage.key}`}
                      style={{ width: `${(stage.value / total) * 100}%` }}
                      title={`${stage.label}: ${formatMs(stage.value)}`}
                    />
                  ),
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
