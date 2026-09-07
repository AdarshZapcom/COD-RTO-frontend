import { ScaleIcon, CheckIcon, XIcon } from '../icons/Icon.jsx';
import './EvidenceComparison.css';

/**
 * GROUP 2 (pairs with EvidencePanel) - owns this file + EvidenceComparison.css only.
 *
 * Two columns, Supporting vs. Counter-evidence. The spec describes this
 * as coming from `signal_comparison.supporting_evidence` /
 * `counter_evidence` - the verified contract has no nested
 * `signal_comparison` object, these are top-level fields on the
 * InvestigationReport itself (`investigation.supporting_evidence`,
 * `investigation.counter_evidence`), each a flat string[] of evidence
 * codes/phrases. Same two lists the doc wants, just not nested.
 *
 * States covered: no investigation yet (defensive), each column empty
 * independently (one side can legitimately have no evidence while the
 * other does), and populated.
 *
 * @param {{ investigation: import('../../types').InvestigationReport | null | undefined }} props
 */
export default function EvidenceComparison({ investigation }) {
  if (!investigation) {
    return (
      <div className="tab-section evidence-comparison">
        <h2 className="panel-title">
          <span className="panel-title__icon">
            <ScaleIcon />
          </span>
          Supporting vs. counter-evidence
        </h2>
        <p className="empty-state">No investigation selected yet.</p>
      </div>
    );
  }

  const { supporting_evidence: supporting = [], counter_evidence: counter = [] } = investigation;

  return (
    <div className="tab-section evidence-comparison">
      <h2 className="panel-title">
        <span className="panel-title__icon">
          <ScaleIcon />
        </span>
        Supporting vs. counter-evidence
      </h2>
      <div className="evidence-comparison__columns">
        <div className="evidence-comparison__column evidence-comparison__column--supporting">
          <h3>Supporting ({supporting.length})</h3>
          {supporting.length === 0 ? (
            <p className="empty-state">No supporting evidence recorded.</p>
          ) : (
            <ul>
              {supporting.map((item) => (
                <li key={item}>
                  <CheckIcon />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="evidence-comparison__column evidence-comparison__column--counter">
          <h3>Counter ({counter.length})</h3>
          {counter.length === 0 ? (
            <p className="empty-state">No counter-evidence recorded.</p>
          ) : (
            <ul>
              {counter.map((item) => (
                <li key={item}>
                  <XIcon />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
