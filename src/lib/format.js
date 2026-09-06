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

// Curated human labels for the backend's SCREAMING_SNAKE_CASE scenario
// constants (src/data_generator.py) — single source of truth so
// OrderPicker's filter dropdown, its per-row badge, and DecisionBanner's
// scenario tag can never disagree on wording.
const SCENARIO_LABELS = {
  NORMAL: 'Normal',
  CLEAR_SAFE: 'Clear safe',
  CLEAR_RISKY: 'Clear risky',
  GOOD_CUSTOMER_BAD_PINCODE: 'Good customer, bad pincode',
  COURIER_PINCODE_ANOMALY: 'Courier x pincode anomaly',
  NEW_EVERYTHING: 'New everything',
  MISSING_COURIER_DATA: 'Missing courier data',
  CONFLICTING_SIGNALS: 'Conflicting signals',
  LOW_SAMPLE_SPIKE: 'Low sample spike',
  NO_HISTORICAL_PRECEDENT: 'No historical precedent',
  TEMPORARY_DISRUPTION: 'Temporary disruption',
};

/**
 * Human-readable label for a raw backend scenario constant, e.g.
 * "GOOD_CUSTOMER_BAD_PINCODE" -> "Good customer, bad pincode". Falls
 * back to a generic underscore/Title Case conversion for any value not
 * in the curated list above, so a badge never reverts to showing a raw
 * SCREAMING_SNAKE_CASE constant if the backend adds a scenario before
 * this list is updated.
 *
 * @param {string|null|undefined} scenario
 * @returns {string}
 */
export function formatScenario(scenario) {
  if (!scenario || typeof scenario !== 'string') return '';
  if (SCENARIO_LABELS[scenario]) return SCENARIO_LABELS[scenario];
  return scenario
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// What each scenario was deliberately constructed to test (docs/research.md
// section 2, "Use Cases to Cover" - the actual design intent behind each of
// the 10 scenario orders, not a guess). Surfacing this next to the scenario
// tag is what actually answers "how was this decided to be CLEAR_SAFE vs
// CLEAR_RISKY" - the tag alone only names the test case, it doesn't explain
// the reasoning behind it.
const SCENARIO_DESCRIPTIONS = {
  CLEAR_SAFE:
    'Loyal customer, healthy pincode, healthy courier, established lane - every signal agrees, so release.',
  CLEAR_RISKY:
    'Customer has a real RTO history, even though the lane itself is clean - hold for verification.',
  GOOD_CUSTOMER_BAD_PINCODE:
    'Strong customer, but the pincode/lane carries real risk - never auto-reject a good customer, hold instead.',
  COURIER_PINCODE_ANOMALY:
    'Otherwise unremarkable customer, but this specific courier x pincode lane is severely deteriorating - a lane-specific problem, not a customer one.',
  NEW_EVERYTHING:
    'No customer history and thin data on every other dimension - a cold start, so confidence must fall and the order escalates rather than defaulting to release.',
  MISSING_COURIER_DATA:
    'Courier performance data is genuinely missing for this lane - the system must say so, not silently fill in a default.',
  CONFLICTING_SIGNALS:
    'Strong, verified customer history is directly contradicted by a risky pincode/lane - both sides substantial, so it goes to a human rather than being forced either way.',
  LOW_SAMPLE_SPIKE:
    'A scary-looking recent RTO rate built on only a handful of orders - too small a sample to trust, so it must not be overreacted to.',
  NO_HISTORICAL_PRECEDENT:
    'Decent order volume, but this exact courier x pincode lane has never been formally investigated before - no track record is treated as a real unknown, not as "probably fine".',
  TEMPORARY_DISRUPTION:
    'A recent dip that is explained by a documented event (e.g. heavy rain, a temporary courier capacity issue) - surfaced as context so it is not misread as persistent deterioration.',
};

/**
 * The design-intent explanation behind a scenario (why this order was
 * built to look this way, per docs/research.md), distinct from
 * formatScenario()'s short display label. Returns '' for NORMAL/unknown
 * values - there is nothing special to explain about an ordinary order.
 *
 * @param {string|null|undefined} scenario
 * @returns {string}
 */
export function describeScenario(scenario) {
  if (!scenario || typeof scenario !== 'string') return '';
  return SCENARIO_DESCRIPTIONS[scenario] ?? '';
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
