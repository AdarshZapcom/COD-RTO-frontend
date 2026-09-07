import { useEffect, useRef, useState } from 'react';
import { getInsights } from '../../api/client';
import { severityColor, formatPercent } from '../../lib/format.js';
import './InsightsStrip.css';

/** Severity is not a plain "how bad" scale - LOW_SAMPLE means the rate
 * itself can't be trusted (too few orders), not "safer than MEDIUM". */
const SEVERITY_LABEL = {
  HIGH: 'High risk',
  MEDIUM: 'Watch',
  LOW_SAMPLE: 'Low sample',
};
const SEVERITY_RANK = { HIGH: 0, MEDIUM: 1, LOW_SAMPLE: 2 };

/**
 * GROUP 5 (pairs with TicketsView) - owns this file + InsightsStrip.css only.
 *
 * GET /insights: courier×pincode routes whose RTO rate has moved enough,
 * or lacks enough sample, to be worth an operator's attention. Fully
 * self-contained - fetches its own data on mount (and on manual
 * refresh), independent of `currentInvestigation` and every other
 * component; severity is color-coded via the shared `severityColor()`
 * helper from src/lib/format.js so it stays consistent with every other
 * severity/risk/decision color in the app.
 *
 * Cards are sorted HIGH → MEDIUM → LOW_SAMPLE (display order only, the
 * fetched data itself is never reshaped) so the routes worth acting on
 * are the first thing an operator scanning the strip sees.
 *
 * @returns {JSX.Element}
 */
export default function InsightsStrip() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function load({ isRefresh = false } = {}) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    getInsights()
      .then((data) => {
        if (mountedRef.current) setInsights(data);
      })
      .catch((err) => {
        if (mountedRef.current) setError(err.message);
      })
      .finally(() => {
        if (!mountedRef.current) return;
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = loading || refreshing;
  const sortedInsights = [...insights].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3),
  );

  return (
    <div className="panel insights-strip">
      <div className="insights-strip__header">
        <h2>Operational insights</h2>
        <button
          type="button"
          className="insights-strip__refresh"
          onClick={() => load({ isRefresh: true })}
          disabled={busy}
          aria-label="Refresh operational insights"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="insights-strip__status" aria-live="polite">
        {loading && <p className="empty-state">Loading operational insights…</p>}

        {!loading && error && (
          <div className="insights-strip__error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => load()}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && insights.length === 0 && (
          <p className="empty-state">No courier × pincode routes currently exceed the insight thresholds.</p>
        )}
      </div>

      {!loading && !error && sortedInsights.length > 0 && (
        <ul className="insights-strip__list" aria-busy={refreshing}>
          {sortedInsights.map((insight) => {
            const isLowSample = insight.severity === 'LOW_SAMPLE';
            const deltaSign = insight.delta > 0 ? 'up' : insight.delta < 0 ? 'down' : 'flat';
            const deltaArrow = deltaSign === 'up' ? '▲' : deltaSign === 'down' ? '▼' : '→';

            return (
              <li
                key={`${insight.courier_id}-${insight.pincode}`}
                className="insights-strip__card"
                style={{ borderTopColor: severityColor(insight.severity) }}
              >
                <div className="insights-strip__card-top">
                  <span className="insights-strip__severity" style={{ background: severityColor(insight.severity) }}>
                    {SEVERITY_LABEL[insight.severity] || insight.severity}
                  </span>
                  <span className="insights-strip__route">
                    {insight.courier_id} · {insight.pincode}
                  </span>
                </div>

                <div className="insights-strip__rates">
                  <span>7d {formatPercent(insight.rto_rate_7d)}</span>
                  <span>30d {formatPercent(insight.rto_rate_30d)}</span>
                  {!isLowSample && (
                    <span className={`insights-strip__delta is-${deltaSign}`}>
                      {deltaArrow} {formatPercent(Math.abs(insight.delta))}
                    </span>
                  )}
                </div>

                <p className="insights-strip__sample">
                  Based on {insight.sample_size} past order{insight.sample_size === 1 ? '' : 's'}
                  {isLowSample && ' - too small to trust the rate above'}
                </p>

                {insight.possible_cause && (
                  <p className="insights-strip__cause">Possible cause: {insight.possible_cause}</p>
                )}

                <p className="insights-strip__action">{insight.recommended_action}</p>

                {insight.estimated_impact && (
                  <p className="insights-strip__impact">{insight.estimated_impact}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
