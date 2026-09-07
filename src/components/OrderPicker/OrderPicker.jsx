import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrders } from '../../api/client';
import { formatScenario, describeScenario } from '../../lib/format.js';
import './OrderPicker.css';

// PAGE_SIZE mirrors the backend's own default (`limit: int = Query(50, ...)`
// in src/api.py) so the first page here matches what GET /orders returns
// with no params at all.
const PAGE_SIZE = 50;

// Real scenario values confirmed in the backend's synthetic data generator
// (src/data_generator.py `special_scenarios` / `scenario` assignments) -
// not guessed. "" means "no scenario filter" (all orders, GET /orders with
// no `scenario` param) rather than a scenario value of its own. Labels come
// from the shared formatScenario() map in lib/format.js (single source of
// truth with the per-row badge and DecisionBanner's scenario tag).
const SCENARIO_VALUES = [
  'NORMAL',
  'CLEAR_SAFE',
  'CLEAR_RISKY',
  'GOOD_CUSTOMER_BAD_PINCODE',
  'COURIER_PINCODE_ANOMALY',
  'NEW_EVERYTHING',
  'MISSING_COURIER_DATA',
  'CONFLICTING_SIGNALS',
  'LOW_SAMPLE_SPIKE',
  'NO_HISTORICAL_PRECEDENT',
  'TEMPORARY_DISRUPTION',
];

const SCENARIOS = [
  { value: '', label: 'All scenarios' },
  ...SCENARIO_VALUES.map((value) => ({ value, label: formatScenario(value) })),
];

/**
 * GROUP 1 (pairs with AdHocOrderForm) - owns this file + OrderPicker.css only.
 *
 * Searchable/filterable list from GET /orders (filter by `scenario` for
 * rehearsal, paginated via `limit`/`offset`). Each row: order_id,
 * customer_id, pincode, courier_id, order_value (+ scenario badge when it's
 * not the default "NORMAL"). Selecting a row calls `onSelectOrder(order_id)`
 * - App owns the actual GET /orders/{id}/investigate call and the
 * resulting shared `currentInvestigation`; this component only
 * fetches/renders the list and reports which row was picked.
 *
 * Full state set: loading (initial + scenario change), a separate
 * loading-more state for pagination that keeps the existing rows on
 * screen, error (with retry) that only clears the list when the very
 * first page failed, empty ("no orders match"), and populated.
 *
 * @param {{ onSelectOrder: (orderId: string) => void, selectedOrderId: string|null }} props
 */
export default function OrderPicker({ onSelectOrder, selectedOrderId }) {
  const [scenario, setScenario] = useState('');
  const [orders, setOrders] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Guards against out-of-order responses: e.g. the user flips the
  // scenario filter twice quickly and the first request's response lands
  // after the second's - without this it would clobber the newer result.
  //
  // Replace (page-0) fetches and append ("Load more") fetches get their own
  // id counters rather than sharing one. If they shared one, a "Load more"
  // request superseded by a scenario change would never self-clear its own
  // loadingMore flag: the new (replace) fetch's finally block resets
  // `loading`, not `loadingMore`, and the stale append fetch's own finally
  // is gated on the shared counter, which the replace fetch has already
  // moved past - so it silently no-ops and loadingMore is stuck true.
  const replaceRequestIdRef = useRef(0);
  const appendRequestIdRef = useRef(0);

  const fetchPage = useCallback((scenarioValue, pageOffset, append) => {
    const activeRef = append ? appendRequestIdRef : replaceRequestIdRef;
    const requestId = activeRef.current + 1;
    activeRef.current = requestId;

    if (!append) {
      // A fresh replace fetch supersedes any in-flight "Load more" fetch for
      // the list it's about to replace: bump the append counter so that
      // request's eventual response can't land on top of this new list, and
      // clear its busy flag immediately instead of leaving the button stuck
      // on "Loading…" until that now-irrelevant request happens to settle.
      appendRequestIdRef.current += 1;
      setLoadingMore(false);
    }

    const setBusy = append ? setLoadingMore : setLoading;
    setBusy(true);
    setError(null);

    getOrders({ scenario: scenarioValue || undefined, limit: PAGE_SIZE, offset: pageOffset })
      .then((data) => {
        if (activeRef.current !== requestId) return;
        setOrders((prev) => (append ? [...prev, ...data] : data));
        setOffset(pageOffset);
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch((err) => {
        if (activeRef.current !== requestId) return;
        setError(err.message);
        if (!append) {
          setOrders([]);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (activeRef.current === requestId) setBusy(false);
      });
  }, []);

  useEffect(() => {
    fetchPage(scenario, 0, false);
    // Re-run whenever the scenario filter changes; fetchPage itself never
    // changes identity (empty dep array) so this only fires on `scenario`.
  }, [scenario, fetchPage]);

  const showInitialLoading = loading && orders.length === 0 && !error;
  const showInitialError = !loading && error && orders.length === 0;
  const showEmpty = !loading && !error && orders.length === 0;
  const showList = orders.length > 0;

  return (
    <div className="panel order-picker">
      <div className="order-picker__header">
        <h2>Orders</h2>
        <label className="order-picker__filter">
          <span>Scenario</span>
          <select
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            disabled={loading}
          >
            {SCENARIOS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {showInitialLoading && (
        <p className="empty-state" role="status">
          Loading orders…
        </p>
      )}

      {showInitialError && (
        <div className="order-picker__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => fetchPage(scenario, 0, false)}>
            Retry
          </button>
        </div>
      )}

      {showEmpty && <p className="empty-state">No orders match this filter.</p>}

      {showList && (
        <>
          <ul className="order-picker__list">
            {orders.map((order) => {
              const isSelected = order.order_id === selectedOrderId;
              const hasValue = typeof order.order_value === 'number';
              return (
                <li key={order.order_id}>
                  <button
                    type="button"
                    aria-current={isSelected ? 'true' : undefined}
                    className={isSelected ? 'is-selected' : ''}
                    onClick={() => onSelectOrder(order.order_id)}
                  >
                    <span className="order-picker__id">{order.order_id}</span>
                    <span className="order-picker__meta">
                      {order.customer_id ?? '-'} · {order.pincode ?? '-'} · {order.courier_id ?? '-'}
                      {hasValue ? ` · ₹${order.order_value.toLocaleString()}` : ''}
                    </span>
                    {order.scenario && order.scenario !== 'NORMAL' && (
                      <span
                        className="order-picker__scenario"
                        title={describeScenario(order.scenario) || undefined}
                      >
                        {formatScenario(order.scenario)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {error && (
            <p className="order-picker__inline-error" role="alert">
              {error}
            </p>
          )}

          {hasMore && (
            <button
              type="button"
              className="order-picker__load-more"
              onClick={() => fetchPage(scenario, offset + PAGE_SIZE, true)}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
