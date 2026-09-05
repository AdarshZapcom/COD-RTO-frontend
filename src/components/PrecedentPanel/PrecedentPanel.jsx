import './PrecedentPanel.css';

/**
 * GROUP 3 (pairs with NarrativePanel) — owns this file + PrecedentPanel.css only.
 *
 * Top-3 retrieved cases from `retrieved_case_ids` / `most_relevant_case_id`.
 *
 * DEVIATION FROM docs/tasks/06-react-frontend.md (flagged, not guessed
 * around): the doc wants each retrieved case tagged with its lane
 * (SAME LANE / cross-lane), its past decision, and its actual outcome.
 * The verified InvestigationReport contract only returns
 * `retrieved_case_ids: string[]` + `most_relevant_case_id: string|null` —
 * there is no `GET /cases/{id}` in the backend to fetch lane/decision/
 * outcome for those IDs, and no such detail is embedded on the report
 * itself. Rendering that breakdown would mean fabricating it, so this
 * panel renders only what the wire contract actually carries: the list
 * of retrieved case IDs, with the one matching `most_relevant_case_id`
 * visually distinguished. If lane/decision/outcome per case matters for
 * the demo, that's a backend contract addition to raise with the
 * architect — not something to invent client-side.
 *
 * States handled: empty (no cases retrieved), populated (list + most-
 * relevant highlight), and a defensive note if `most_relevant_case_id`
 * doesn't actually appear in `retrieved_case_ids` (a data inconsistency
 * worth surfacing rather than silently swallowing). No loading/error
 * state belongs to this component — it never fetches anything itself;
 * App.jsx only mounts it once `currentInvestigation` is already a
 * populated InvestigationReport, so a missing/null `investigation` prop
 * is not a real runtime case here (still guarded below, defensively).
 *
 * @param {{ investigation: import('../../types').InvestigationReport }} props
 */
export default function PrecedentPanel({ investigation }) {
  if (!investigation) {
    return (
      <div className="panel precedent-panel">
        <h2>Precedent cases</h2>
        <p className="empty-state">No investigation loaded.</p>
      </div>
    );
  }

  const { retrieved_case_ids: rawCaseIds, most_relevant_case_id: mostRelevant } = investigation;
  const caseIds = Array.isArray(rawCaseIds) ? rawCaseIds : [];
  const mostRelevantMissing = Boolean(mostRelevant) && !caseIds.includes(mostRelevant);

  return (
    <div className="panel precedent-panel">
      <h2>Precedent cases</h2>

      {caseIds.length === 0 ? (
        <p className="empty-state">No precedent cases retrieved.</p>
      ) : (
        <>
          <p className="precedent-panel__count">
            {caseIds.length} case{caseIds.length === 1 ? '' : 's'} retrieved
          </p>
          <ul className="precedent-panel__list">
            {caseIds.map((caseId, index) => {
              const isMostRelevant = caseId === mostRelevant;
              return (
                <li
                  key={`${caseId}-${index}`}
                  className={
                    isMostRelevant
                      ? 'precedent-panel__item precedent-panel__item--most-relevant'
                      : 'precedent-panel__item'
                  }
                >
                  <span className="precedent-panel__case-id">{caseId}</span>
                  {isMostRelevant && <span className="precedent-panel__badge">MOST RELEVANT</span>}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {mostRelevantMissing && (
        <p className="precedent-panel__inconsistency" role="alert">
          Most relevant case <strong>{mostRelevant}</strong> was not among the retrieved cases.
        </p>
      )}
    </div>
  );
}
