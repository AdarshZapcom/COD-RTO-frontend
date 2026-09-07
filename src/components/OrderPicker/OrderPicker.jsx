import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { getOrders } from '../../api/client';
import { formatScenario, describeScenario } from '../../lib/format.js';
import { windowedPageNumbers } from '../../lib/pagination.js';
import { ListIcon } from '../icons/Icon.jsx';
import './OrderPicker.css';

// Real numbered pagination against GET /orders' limit/offset + its
// X-Total-Count header (see getOrders() in api/client.js). Kept small
// (10) so a page of order rows stays scannable in the fixed-width rail
// without much scrolling.
const PAGE_SIZE = 10;

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
 * rehearsal), with real numbered pagination (Prev / 1 2 3 ... / Next)
 * against the backend's limit/offset + X-Total-Count. Each row: order_id,
 * customer_id, pincode, courier_id, order_value (+ scenario badge when it's
 * not the default "NORMAL"). Selecting a row calls `onSelectOrder(order_id)`
 * - App owns the actual GET /orders/{id}/investigate call and the
 * resulting shared `currentInvestigation`; this component only
 * fetches/renders the list and reports which row was picked.
 *
 * Full state set: loading (initial + scenario/page change), error (with
 * retry) that only clears the list when the page load itself failed,
 * empty ("no orders match"), and populated.
 *
 * Exposes `focusList()` via ref (see App.jsx's "Investigate" empty-state
 * hint) so a sibling can direct focus/attention here without reaching
 * into internals - focuses the scenario filter, which doubles as the
 * list's own visible heading control.
 *
 * @param {{ onSelectOrder: (orderId: string) => void, selectedOrderId: string|null }} props
 */
const OrderPicker = forwardRef(function OrderPicker({ onSelectOrder, selectedOrderId }, ref) {
  const [scenario, setScenario] = useState('');
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const scenarioSelectRef = useRef(null);

  useImperativeHandle(ref, () => ({
    // scrollIntoView first: focus() alone can be too subtle to notice
    // (a thin outline, no visible motion) when this panel is currently
    // scrolled out of view - e.g. the app-rail is stacked above
    // app-main below the 860px breakpoint.
    focusList: () => {
      const el = scenarioSelectRef.current;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    },
  }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Guards against out-of-order responses: e.g. the user flips the
  // scenario filter or the page twice quickly and the first request's
  // response lands after the second's - without this it would clobber
  // the newer result.
  const requestIdRef = useRef(0);

  const fetchPage = useCallback((scenarioValue, targetPage) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setLoading(true);
    setError(null);

    getOrders({
      scenario: scenarioValue || undefined,
      limit: PAGE_SIZE,
      offset: (targetPage - 1) * PAGE_SIZE,
    })
      .then(({ orders: data, total: totalCount }) => {
        if (requestIdRef.current !== requestId) return;
        setOrders(data);
        setTotal(totalCount);
        setPage(targetPage);
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        setError(err.message);
        setOrders([]);
        setTotal(0);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchPage(scenario, 1);
    // Re-run whenever the scenario filter changes (always resets to page
    // 1); fetchPage itself never changes identity (empty dep array) so
    // this only fires on `scenario`.
  }, [scenario, fetchPage]);

  const showInitialLoading = loading && orders.length === 0 && !error;
  const showInitialError = !loading && error && orders.length === 0;
  const showEmpty = !loading && !error && orders.length === 0;
  const showList = orders.length > 0;

  return (
    <div className="panel order-picker">
      <div className="order-picker__header">
        <h2 className="panel-title">
          <span className="panel-title__icon">
            <ListIcon />
          </span>
          Orders
        </h2>
        <label className="order-picker__filter">
          <span>Scenario</span>
          <select
            ref={scenarioSelectRef}
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
          <button type="button" onClick={() => fetchPage(scenario, page)}>
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

          {totalPages > 1 && (
            <nav className="order-picker__pagination" aria-label="Orders pages">
              <button
                type="button"
                onClick={() => fetchPage(scenario, page - 1)}
                disabled={page <= 1 || loading}
              >
                Prev
              </button>

              {windowedPageNumbers(page, totalPages).map((entry, index) =>
                entry === '…' ? (
                  <span key={`ellipsis-${index}`} className="order-picker__pagination-ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    className={entry === page ? 'is-active' : ''}
                    aria-current={entry === page ? 'page' : undefined}
                    onClick={() => fetchPage(scenario, entry)}
                    disabled={loading}
                  >
                    {entry}
                  </button>
                ),
              )}

              <button
                type="button"
                onClick={() => fetchPage(scenario, page + 1)}
                disabled={page >= totalPages || loading}
              >
                Next
              </button>

              <span className="order-picker__pagination-summary">
                Page {page} of {totalPages} ({total})
              </span>
            </nav>
          )}
        </>
      )}
    </div>
  );
});

export default OrderPicker;
