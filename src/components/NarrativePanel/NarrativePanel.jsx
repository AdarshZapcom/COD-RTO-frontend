import './NarrativePanel.css';

const SOURCE_LABELS = {
  llm: 'AI SUMMARY',
  template_fallback: 'TEMPLATE FALLBACK',
};

/**
 * GROUP 3 (pairs with PrecedentPanel) - owns this file + NarrativePanel.css only.
 *
 * Renders the `narrative` text with an always-visible `narrative_source`
 * tag ("llm" vs "template_fallback"), styled distinctly per value -
 * this is the credibility signal that nothing is faked if the live LLM
 * call fails mid-demo and the backend falls back to a templated
 * narrative, so it must never be hidden or minimized.
 *
 * States handled:
 * - populated: narrative text + source tag (green for llm, amber for
 *   template_fallback so a fallback is visibly flagged, not disguised).
 * - empty: `narrative` missing/blank - shown as an explicit empty
 *   state rather than an empty paragraph, source tag still shown since
 *   it's independent report metadata.
 * - unrecognized `narrative_source` (not "llm"/"template_fallback") -
 *   rendered as a neutral "SOURCE UNKNOWN" tag instead of silently
 *   guessing which color it should be.
 * No loading/error state belongs to this component - it never fetches
 * anything itself; App.jsx only mounts it once `currentInvestigation`
 * is already a populated InvestigationReport. A missing `investigation`
 * prop is still guarded against defensively below.
 *
 * @param {{ investigation: import('../../types').InvestigationReport }} props
 */
export default function NarrativePanel({ investigation }) {
  if (!investigation) {
    return (
      <div className="panel narrative-panel">
        <h2>Narrative</h2>
        <p className="empty-state">No investigation loaded.</p>
      </div>
    );
  }

  const { narrative, narrative_source: narrativeSource } = investigation;
  const knownSource = narrativeSource === 'llm' || narrativeSource === 'template_fallback';
  const sourceModifier = knownSource ? narrativeSource : 'unknown';
  const sourceLabel = knownSource ? SOURCE_LABELS[narrativeSource] : 'SOURCE UNKNOWN';
  const hasNarrative = typeof narrative === 'string' && narrative.trim().length > 0;

  return (
    <div className="panel narrative-panel">
      <h2>Narrative</h2>
      <span
        className={`narrative-panel__source narrative-panel__source--${sourceModifier}`}
        role="status"
      >
        {sourceLabel}
      </span>
      {hasNarrative ? (
        <p>{narrative}</p>
      ) : (
        <p className="empty-state">No narrative available for this investigation.</p>
      )}
    </div>
  );
}
