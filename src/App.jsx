import { useCallback, useRef, useState } from 'react';
import { getOrderInvestigation, postInvestigate } from './api/client';

import OrderPicker from './components/OrderPicker/OrderPicker.jsx';
import AdHocOrderForm from './components/AdHocOrderForm/AdHocOrderForm.jsx';
import DecisionBanner from './components/DecisionBanner/DecisionBanner.jsx';
import InvestigationTabs from './components/InvestigationTabs/InvestigationTabs.jsx';
import InsightsStrip from './components/InsightsStrip/InsightsStrip.jsx';
import TicketsView from './components/TicketsView/TicketsView.jsx';
import { SearchIcon, TicketIcon } from './components/icons/Icon.jsx';

// Investigate = pick/submit one order and see its decision. Ops & tickets =
// courier x pincode monitoring and open escalations, independent of any
// selected order. Plain local state, not a route - switching modes never
// touches the URL or unmounts/loses either screen's own fetched data for
// longer than a normal remount (both re-fetch cheaply on their own).
const MODE_TABS = [
  { key: 'investigate', label: 'Investigate', Icon: SearchIcon },
  { key: 'operations', label: 'Ops & tickets', Icon: TicketIcon },
];

// Single shared "current investigation" object, lifted here per
// docs/tasks/06-react-frontend.md ("What NOT to build") - no global
// state library. Every panel below the banner reads off the same
// `currentInvestigation` (an InvestigationReport | null) passed as a
// prop; nothing else is centralized. OrderPicker's own order list and
// filters, AdHocOrderForm's own field values, InsightsStrip's insights,
// and TicketsView's tickets are all local state inside those
// components - they never need to live here.
//
// The two things that CAN produce a new `currentInvestigation`
// (selecting an order, submitting the ad-hoc form) both funnel through
// `runInvestigation` so there is exactly one owner of the loading/error
// state for that shared object, instead of two components racing to
// set it independently.
export default function App() {
  const [mode, setMode] = useState('investigate');
  const [currentInvestigation, setCurrentInvestigation] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [investigationLoading, setInvestigationLoading] = useState(false);
  const [investigationError, setInvestigationError] = useState(null);

  // Guards against out-of-order responses: OrderPicker's row buttons and
  // AdHocOrderForm's submit both funnel through runInvestigation, and
  // neither disables every other trigger while a request is in flight (only
  // the ad-hoc form's own submit is disabled during its own request). So a
  // slower request started first (e.g. an order click) can resolve after a
  // faster one started later (e.g. an ad-hoc submit) - without this guard
  // the slower, stale response would win and silently overwrite the newer
  // result. Same pattern as OrderPicker's fetchPage requestIdRef.
  const requestIdRef = useRef(0);

  // Mirrors currentInvestigation so the catch branch below can check "is
  // there already a good result on screen?" without putting
  // currentInvestigation itself in runInvestigation's dependency array
  // (which would recreate the callback - and the onSelectOrder/onSubmit
  // props built from it - on every investigation). Kept in sync by
  // applyCurrentInvestigation, the only place currentInvestigation state
  // is ever set.
  const currentInvestigationRef = useRef(null);

  const applyCurrentInvestigation = useCallback((value) => {
    currentInvestigationRef.current = value;
    setCurrentInvestigation(value);
  }, []);

  const runInvestigation = useCallback(async (fetchReport, orderIdForHighlight) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setInvestigationLoading(true);
    setInvestigationError(null);
    try {
      const report = await fetchReport();
      if (requestIdRef.current !== requestId) return;
      applyCurrentInvestigation(report);
      setSelectedOrderId(orderIdForHighlight ?? report.order_id ?? null);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      const previous = currentInvestigationRef.current;
      if (previous) {
        // A previous investigation is already on screen (DecisionBanner is
        // pinned above the tabs, always visible without scrolling) - a
        // failed refresh (e.g. a 404 on a newly selected order) must not
        // blank it out. Keep showing it and surface the new error
        // alongside it instead of silently reverting to the empty state.
        setInvestigationError(
          `Couldn't refresh: ${err.message} - still showing the previous investigation for ${previous.order_id}.`,
        );
      } else {
        setInvestigationError(err.message);
        applyCurrentInvestigation(null);
      }
    } finally {
      if (requestIdRef.current === requestId) setInvestigationLoading(false);
    }
  }, [applyCurrentInvestigation]);

  const handleSelectOrder = useCallback(
    (orderId) => runInvestigation(() => getOrderInvestigation(orderId), orderId),
    [runInvestigation],
  );

  const handleAdHocSubmit = useCallback(
    (payload) => runInvestigation(() => postInvestigate(payload), null),
    [runInvestigation],
  );

  // Roving-tabindex arrow nav: only the active mode is Tab-reachable, so
  // moving the "selected" mode via arrow keys must also move actual DOM
  // focus there - see the identical pattern/comment in InvestigationTabs.
  const modeTabRefs = useRef({});

  function focusMode(key) {
    setMode(key);
    modeTabRefs.current[key]?.focus();
  }

  function handleModeKeyDown(event) {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const index = MODE_TABS.findIndex((tab) => tab.key === mode);
    const nextIndex = event.key === 'ArrowRight'
      ? (index + 1) % MODE_TABS.length
      : (index - 1 + MODE_TABS.length) % MODE_TABS.length;
    focusMode(MODE_TABS[nextIndex].key);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <SearchIcon width={22} height={22} />
          <h1>Find the Signal</h1>
        </div>
        <div className="mode-switcher" role="tablist" aria-label="View" onKeyDown={handleModeKeyDown}>
          {MODE_TABS.map((tab) => {
            const isActive = tab.key === mode;
            return (
              <button
                key={tab.key}
                type="button"
                ref={(el) => {
                  modeTabRefs.current[tab.key] = el;
                }}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className={isActive ? 'mode-switcher__tab is-active' : 'mode-switcher__tab'}
                onClick={() => setMode(tab.key)}
              >
                <tab.Icon />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {mode === 'investigate' ? (
        <div className="app-body">
          <div className="app-rail">
            <OrderPicker onSelectOrder={handleSelectOrder} selectedOrderId={selectedOrderId} />
            <AdHocOrderForm onSubmit={handleAdHocSubmit} submitting={investigationLoading} />
          </div>

          <div className="app-main">
            {investigationError && (
              <div className="panel panel--error" role="alert">
                {investigationError}
              </div>
            )}

            {investigationLoading && (
              <div className="panel empty-state" role="status" aria-live="polite">
                {currentInvestigation ? 'Updating investigation…' : 'Investigating…'}
              </div>
            )}

            {currentInvestigation ? (
              <>
                <DecisionBanner investigation={currentInvestigation} />
                <InvestigationTabs investigation={currentInvestigation} />
              </>
            ) : (
              !investigationLoading && (
                <div className="panel empty-state">
                  Pick an order from the list, or submit an ad-hoc order, to see an investigation.
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="app-operations">
          <InsightsStrip />
          <TicketsView />
        </div>
      )}
    </div>
  );
}
