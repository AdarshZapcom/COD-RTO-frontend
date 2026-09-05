// Small pure presentation helpers shared across components (color coding,
// number formatting). Scaffold-owned and frozen before parallel component
// work starts so no two component groups need to touch the same shared
// file — treat as stable API, extend rather than rewrite if a new group
// genuinely needs another helper.

/** @param {'RELEASE'|'HOLD_FOR_VERIFICATION'|'ESCALATE'} decision */
export function decisionColor(decision) {
  switch (decision) {
    case 'RELEASE':
      return '#1a7f37';
    case 'HOLD_FOR_VERIFICATION':
      return '#9a6700';
    case 'ESCALATE':
      return '#cf222e';
    default:
      return '#5b6472';
  }
}

/** @param {'LOW'|'MEDIUM'|'HIGH'} riskLevel */
export function riskColor(riskLevel) {
  switch (riskLevel) {
    case 'LOW':
      return '#1a7f37';
    case 'MEDIUM':
      return '#9a6700';
    case 'HIGH':
      return '#cf222e';
    default:
      return '#5b6472';
  }
}

/** @param {'HIGH'|'MEDIUM'|'LOW_SAMPLE'} severity */
export function severityColor(severity) {
  switch (severity) {
    case 'HIGH':
      return '#cf222e';
    case 'MEDIUM':
      return '#9a6700';
    case 'LOW_SAMPLE':
      return '#5b6472';
    default:
      return '#5b6472';
  }
}

/** @param {number} value 0-1 fraction */
export function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

/** @param {number} ms */
export function formatMs(ms) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  return `${ms.toFixed(0)} ms`;
}

const CRITICAL_PREFIX = 'CRITICAL: ';

/**
 * Splits an uncertainty_flags list into { critical, warning } tiers,
 * stripping the wire-level "CRITICAL: " prefix (the one reliable
 * discriminator decision_engine.compute_uncertainty_flags emits — see
 * the backend). Single source of truth: DecisionBanner, EvidencePanel,
 * and TicketsView all consume this instead of each re-deriving the
 * split, so the three can never silently disagree if the backend's
 * exact wording changes.
 *
 * TicketsView's ticket rows join this same field as a " | "-string, not
 * an array — split with the sibling splitJoined() there first, then
 * pass the resulting array here.
 *
 * @param {string[]} flags
 * @returns {{ critical: string[], warning: string[] }}
 */
export function splitUncertaintyFlags(flags) {
  const critical = [];
  const warning = [];
  (Array.isArray(flags) ? flags : []).forEach((flag) => {
    if (typeof flag !== 'string') return;
    if (flag.startsWith(CRITICAL_PREFIX)) {
      critical.push(flag.slice(CRITICAL_PREFIX.length));
    } else {
      warning.push(flag);
    }
  });
  return { critical, warning };
}
