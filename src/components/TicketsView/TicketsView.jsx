import { useEffect, useRef, useState } from 'react';
import { getTickets, resolveTicket } from '../../api/client';
import { decisionColor, riskColor, formatDecision, splitUncertaintyFlags } from '../../lib/format.js';
import { windowedPageNumbers } from '../../lib/pagination.js';
import { TicketIcon, RefreshIcon } from '../icons/Icon.jsx';
import './TicketsView.css';

/** Raw ticket rows join these as " | "-strings, not arrays like
 * InvestigationReport's fields of the same name - split before use. */
function splitJoined(value) {
  return value ? value.split(' | ').filter(Boolean) : [];
}

function formatTimestamp(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

const EMPTY_RESOLVE_FORM = { resolvedBy: '', resolutionNote: '', resolutionOutcome: '' };

// The three real ops outcomes for a HOLD/ESCALATE ticket - tied to the
// actual question a reviewer is answering (ship this order COD or
// not), not a generic status list. Must match api.py's
// RESOLUTION_OUTCOMES allowlist exactly.
// `label` is the full descriptive text used only in the resolve form
// itself (spelling out the real-world consequence at the moment
// someone is actually making the call). `short` is the same outcome
// in filter/badge form - deliberately not "Hold", since that word
// already means the automated, pre-review HOLD_FOR_VERIFICATION
// decision elsewhere in this same view; reusing it here for a human's
// *final* call would make "Hold" mean two different things depending
// on which tab you're looking at.
const RESOLUTION_OUTCOMES = [
  { value: 'VERIFIED_RELEASE', label: 'Verified — release (ship COD)', short: 'Release' },
  { value: 'RISKY_BLOCK_COD', label: 'Risky — block COD (cancel / prepaid only)', short: 'Risky (block COD)' },
  { value: 'ESCALATE_MANAGER', label: 'Escalate to manager', short: 'Escalated' },
];

const RESOLUTION_OUTCOME_LABELS = Object.fromEntries(
  RESOLUTION_OUTCOMES.map((option) => [option.value, option.short])
);

// Resolved-tab options for the shared "Decision" filter slot (see
// hasActiveFilter/decisionFilter above) - same values as
// RESOLUTION_OUTCOMES, reshaped with a leading "All" to match
// DECISION_FILTERS/RISK_FILTERS' shape, and using the short label so
// the dropdown stays scannable.
const OUTCOME_FILTERS = [
  { value: '', label: 'All' },
  ...RESOLUTION_OUTCOMES.map((option) => ({ value: option.value, label: option.short })),
];

// Client-side declutter filters over the currently-loaded page of
// tickets - not a new backend query param (GET /tickets has no
// decision/risk_level filter today), so these only narrow down what's
// already on screen, same as any other page-local UI state. Good
// enough for "find the ESCALATE ticket among these 7" without a
// backend contract change; a filter that must reach across pages would
// need real server-side support instead.
const DECISION_FILTERS = [
  { value: '', label: 'All' },
  { value: 'HOLD_FOR_VERIFICATION', label: 'Hold for verification' },
  { value: 'ESCALATE', label: 'Escalate' },
];
const RISK_FILTERS = [
  { value: '', label: 'All' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

// A live event/stress-test run can accumulate hundreds of ad hoc
// tickets, so this view needs real numbered pagination against the
// backend's limit/offset support. Kept small (7) so a page of
// evidence-heavy ticket cards stays scannable without much scrolling.
const PAGE_SIZE = 7;

// GET /tickets?status= only ever accepts these two (see src/api.py) -
// backed by the escalation_tickets.status column, which resolve_ticket()
// already sets to RESOLVED, so this is a real server-side query, not a
// client-side filter over one fetched page like decision/risk above.
const STATUS_TABS = [
  { key: 'OPEN', label: 'Open' },
  { key: 'RESOLVED', label: 'Resolved' },
];

/**
 * GROUP 5 (pairs with InsightsStrip) - owns this file + TicketsView.css only.
 *
 * GET /tickets?status=OPEN|RESOLVED (an Open/Resolved tab switches
 * which), with a resolve action (POST /tickets/{id}/resolve) on the
 * Open tab only - a resolved ticket shows its outcome badge plus who
 * closed it and why, instead of a Resolve button/form. Fully
 * self-contained - fetches its own data on mount, on manual refresh,
 * and on tab switch, independent of `currentInvestigation` and every
 * other component.
 *
 * Resolving is destructive (closes the escalation) and the backend
 * requires a real `resolved_by` / `resolution_note` / `resolution_outcome`
 * (the actual ops call: ship COD, block COD, or escalate further - see
 * RESOLUTION_OUTCOMES), so "Resolve" does not call the API directly -
 * it reveals an inline confirm form
 * (required resolved-by + resolution-note fields) scoped to that one
 * ticket; only submitting that form calls resolveTicket(). A native
 * `confirm()` popup would be unstyled/blocking and a full modal is more
 * ceremony than a demo app needs when the required fields already force
 * deliberation. On success the ticket is removed from the local list
 * (it's no longer OPEN) rather than re-fetching the whole list.
 *
 * @returns {JSX.Element}
 */
export default function TicketsView() {
  const [tickets, setTickets] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const [statusTab, setStatusTab] = useState('OPEN');
  // The status the currently-loaded `tickets` actually belong to - set
  // only once real data for that status arrives (see loadTickets). Not
  // the same as statusTab, which flips the instant the toggle is
  // clicked: a RESOLVED page can take a couple of seconds against a
  // large table, and rendering must not label still-visible OPEN rows
  // as resolved just because the toggle already says Resolved.
  const [ticketsStatus, setTicketsStatus] = useState('OPEN');

  const [decisionFilter, setDecisionFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  // Only meaningful on the Resolved tab (Open tickets have no outcome
  // yet) - filters resolution_outcome, kept separate from decisionFilter
  // (which always filters the original automated `decision` field, on
  // either tab - a resolved ticket still carries its original decision,
  // and that stays a useful thing to filter by even after resolution).
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const hasActiveFilter =
    decisionFilter !== '' || riskFilter !== '' || (ticketsStatus === 'RESOLVED' && outcomeFilter !== '');

  // Guards against out-of-order responses: switching pages quickly (or
  // hitting refresh mid-fetch) could otherwise let a slower, earlier
  // request's response land after a faster, later one and show the
  // wrong page - same reasoning as OrderPicker.fetchPage's requestIdRef.
  const requestIdRef = useRef(0);

  const [activeTicketId, setActiveTicketId] = useState(null);
  const [resolveForm, setResolveForm] = useState(EMPTY_RESOLVE_FORM);
  const [resolvingId, setResolvingId] = useState(null);
  const [resolveErrors, setResolveErrors] = useState({});
  // Transient screen-reader-only announcement (e.g. "Ticket TCK-X
  // resolved.") - the row itself just disappears visually, so this is
  // the only signal a screen-reader user gets that the action landed.
  const [announcement, setAnnouncement] = useState('');

  const mountedRef = useRef(true);
  const resolvedByInputRef = useRef(null);
  const headingRef = useRef(null);
  // One DOM node per ticket's "Resolve" button, so focus can be
  // returned to the exact button that opened a form once it's
  // cancelled (rather than dropping to the document body).
  const resolveButtonRefs = useRef({});
  // Set right before a state update that will move focus once React
  // has re-rendered (a plain synchronous .focus() call here would target
  // the DOM as it exists *before* this render's changes land). Consumed
  // by the effect below, which runs after every render.
  const pendingFocusRef = useRef(null);
  // Mirrors activeTicketId so confirmResolve can check, after its await,
  // whether the operator is still on the same ticket's form without
  // depending on a stale closure over state.
  const activeTicketIdRef = useRef(null);

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    pendingFocusRef.current = null;
    if (pending.type === 'resolve-button') {
      resolveButtonRefs.current[pending.ticketId]?.focus();
    } else if (pending.type === 'heading') {
      headingRef.current?.focus();
    }
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    activeTicketIdRef.current = activeTicketId;
  }, [activeTicketId]);

  function loadTickets({ isRefresh = false, targetPage = 1 } = {}) {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    // Captured now, not read again in .then() below: a RESOLVED page can
    // take a couple of seconds (large table), long enough that statusTab
    // could have changed again before this particular request resolves -
    // tickets/ticketsStatus must always be tagged with the status THIS
    // request actually asked for, not whatever the toggle shows by then.
    const requestedStatus = statusTab;

    // Also clear the OTHER busy flag, not just set this request's own:
    // if this call supersedes an in-flight request of the other kind
    // (e.g. React StrictMode's dev double-invoke firing the initial
    // load then immediately a tab-switch refresh), that older request's
    // finally() below no-ops once it sees requestIdRef has moved on -
    // it never gets to clear its own flag, so without this the stale
    // flag (most often listLoading) would stay stuck true forever and
    // the panel would show "Loading…" indefinitely.
    if (isRefresh) {
      setRefreshing(true);
      setListLoading(false);
    } else {
      setListLoading(true);
      setRefreshing(false);
    }
    setListError(null);

    getTickets({ status: requestedStatus, limit: PAGE_SIZE, offset: (targetPage - 1) * PAGE_SIZE })
      .then(({ tickets: data, total: totalCount }) => {
        if (!mountedRef.current || requestIdRef.current !== requestId) return;
        setTickets(data);
        // Tags the data with the status it was actually fetched for -
        // rendering (Resolve button vs. resolution info) keys off this,
        // never off statusTab directly, so a still-in-flight tab switch
        // never mislabels the previous tab's tickets as belonging to
        // the newly-selected one before the real data arrives.
        setTicketsStatus(requestedStatus);
        setTotal(totalCount);
        setPage(targetPage);
      })
      .catch((err) => {
        if (!mountedRef.current || requestIdRef.current !== requestId) return;
        setListError(err.message);
        setTickets([]);
        setTotal(0);
      })
      .finally(() => {
        if (!mountedRef.current || requestIdRef.current !== requestId) return;
        if (isRefresh) setRefreshing(false);
        else setListLoading(false);
      });
  }

  // True only for the very first fetch (nothing on screen yet to keep
  // showing). A later status-tab switch instead goes through loadTickets'
  // isRefresh path - same as a manual Refresh click - so the current
  // list/filter bar stay visible (just marked aria-busy) instead of the
  // whole panel blanking out to "Loading…" and back, which read as the
  // page reloading rather than a quick in-place update.
  const isFirstTicketLoadRef = useRef(true);

  useEffect(() => {
    if (isFirstTicketLoadRef.current) {
      isFirstTicketLoadRef.current = false;
      loadTickets();
    } else {
      loadTickets({ isRefresh: true });
    }
    // Re-run whenever the status tab changes (always resets to page 1);
    // loadTickets itself isn't memoized, so this intentionally only
    // fires on statusTab, same pattern as OrderPicker's scenario effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTab]);

  function handleStatusTabChange(nextStatus) {
    if (nextStatus === statusTab) return;
    // A resolve form open on an OPEN ticket makes no sense once we've
    // navigated away from the Open tab - drop it rather than leave a
    // stale form hanging off a ticket no longer even in view.
    setActiveTicketId(null);
    setResolveForm(EMPTY_RESOLVE_FORM);
    // Outcome only applies to Resolved tickets - drop it on every tab
    // switch so it never carries over as a stale, invisible filter.
    setOutcomeFilter('');
    setStatusTab(nextStatus);
  }

  // Move focus into the confirm form the moment it appears, for keyboard
  // and screen-reader users triggering it from the "Resolve" button.
  useEffect(() => {
    if (activeTicketId && resolvedByInputRef.current) {
      resolvedByInputRef.current.focus();
    }
  }, [activeTicketId]);

  function openResolveForm(ticketId) {
    setActiveTicketId(ticketId);
    setResolveForm(EMPTY_RESOLVE_FORM);
    setResolveErrors((prev) => ({ ...prev, [ticketId]: null }));
  }

  function cancelResolveForm(ticketId) {
    // Return focus to the button that opened this form, rather than
    // letting it fall through to the document body once the form
    // (which currently holds focus) unmounts.
    pendingFocusRef.current = { type: 'resolve-button', ticketId };
    setActiveTicketId(null);
    setResolveForm(EMPTY_RESOLVE_FORM);
  }

  function handleFormChange(field) {
    return (event) => setResolveForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function confirmResolve(ticketId) {
    const resolvedBy = resolveForm.resolvedBy.trim();
    const resolutionNote = resolveForm.resolutionNote.trim();
    const resolutionOutcome = resolveForm.resolutionOutcome;
    if (!resolvedBy || !resolutionNote || !resolutionOutcome) return;

    setResolvingId(ticketId);
    setResolveErrors((prev) => ({ ...prev, [ticketId]: null }));
    try {
      await resolveTicket(ticketId, { resolvedBy, resolutionNote, resolutionOutcome });
      if (!mountedRef.current) return;
      // Screen-reader announcement: the resolved row is about to
      // disappear visually with no other signal that anything happened.
      // Fires regardless of which ticket's form is currently active.
      setAnnouncement(`Ticket ${ticketId} resolved.`);
      // Only clear the shared active-ticket/form state if it still belongs
      // to this ticket - the operator may have already moved on to a
      // different ticket's resolve form while this request was in flight,
      // and that form must not be silently closed or wiped out from under
      // them.
      if (activeTicketIdRef.current === ticketId) {
        // The row (and its Resolve button) is about to be removed from
        // the list entirely, so there's no button to return focus to -
        // send it to the panel heading instead of letting it fall
        // through to the document body.
        pendingFocusRef.current = { type: 'heading' };
        setActiveTicketId(null);
        setResolveForm(EMPTY_RESOLVE_FORM);
      }
      // Resolved tickets are no longer OPEN - drop it locally instead of
      // a full round-trip re-fetch. Also decrement `total` so the page
      // count doesn't drift stale until the next refresh/page change.
      setTickets((prev) => prev.filter((t) => t.ticket_id !== ticketId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      if (mountedRef.current) {
        setResolveErrors((prev) => ({ ...prev, [ticketId]: err.message }));
      }
    } finally {
      if (mountedRef.current) setResolvingId(null);
    }
  }

  const canConfirm =
    resolveForm.resolvedBy.trim() !== '' &&
    resolveForm.resolutionNote.trim() !== '' &&
    resolveForm.resolutionOutcome !== '';

  const visibleTickets = tickets.filter(
    (t) =>
      (decisionFilter === '' || t.decision === decisionFilter) &&
      (riskFilter === '' || t.risk_level === riskFilter) &&
      (ticketsStatus !== 'RESOLVED' || outcomeFilter === '' || t.resolution_outcome === outcomeFilter),
  );

  return (
    <div className="panel tickets-view">
      <div aria-live="polite" className="visually-hidden">
        {announcement}
      </div>
      <div className="tickets-view__header">
        <h2 className="panel-title" ref={headingRef} tabIndex={-1}>
          <span className="panel-title__icon">
            <TicketIcon />
          </span>
          Tickets
        </h2>
        <div className="tickets-view__status-tabs" role="tablist" aria-label="Ticket status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={statusTab === tab.key}
              className={statusTab === tab.key ? 'is-active' : ''}
              onClick={() => handleStatusTabChange(tab.key)}
              disabled={listLoading || refreshing}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="tickets-view__refresh"
          onClick={() => loadTickets({ isRefresh: true })}
          disabled={listLoading || refreshing}
          aria-label={
            refreshing
              ? `Refreshing ${statusTab.toLowerCase()} tickets`
              : `Refresh ${statusTab.toLowerCase()} tickets`
          }
        >
          <RefreshIcon className={refreshing ? 'icon-spin' : undefined} />
        </button>
      </div>

      <div className="tickets-view__status" aria-live="polite">
        {listLoading && <p className="empty-state">Loading {statusTab.toLowerCase()} tickets…</p>}

        {!listLoading && listError && (
          <div className="tickets-view__error" role="alert">
            <span>{listError}</span>
            <button type="button" onClick={() => loadTickets()}>
              Retry
            </button>
          </div>
        )}

        {!listLoading && !listError && tickets.length === 0 && (
          <p className="empty-state">
            {statusTab === 'OPEN' ? 'No open tickets - all clear.' : 'No resolved tickets yet.'}
          </p>
        )}
      </div>

      {!listLoading && !listError && tickets.length > 0 && (
        <div className="tickets-view__filter-bar">
          <label className="tickets-view__filter-field">
            <span>Decision</span>
            <select value={decisionFilter} onChange={(event) => setDecisionFilter(event.target.value)}>
              {DECISION_FILTERS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="tickets-view__filter-field">
            <span>Risk</span>
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
              {RISK_FILTERS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {ticketsStatus === 'RESOLVED' && (
            <label className="tickets-view__filter-field">
              <span>Outcome</span>
              <select value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value)}>
                {OUTCOME_FILTERS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {hasActiveFilter && (
            <button
              type="button"
              className="tickets-view__filter-clear"
              onClick={() => {
                setDecisionFilter('');
                setRiskFilter('');
                setOutcomeFilter('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {!listLoading && !listError && tickets.length > 0 && visibleTickets.length === 0 && (
        <p className="empty-state">No tickets on this page match the current filters.</p>
      )}

      {!listLoading && !listError && visibleTickets.length > 0 && hasActiveFilter && (
        <p className="tickets-view__filter-summary">
          {visibleTickets.length} of {tickets.length} on this page shown
        </p>
      )}

      {!listLoading && !listError && visibleTickets.length > 0 && (
        <ul className="tickets-view__list" aria-busy={refreshing}>
          {visibleTickets.map((ticket) => {
            const isActive = activeTicketId === ticket.ticket_id;
            const isResolving = resolvingId === ticket.ticket_id;
            const rowError = resolveErrors[ticket.ticket_id];
            const confidencePct =
              typeof ticket.confidence === 'number' ? `${(ticket.confidence * 100).toFixed(0)}%` : '-';

            const supportingEvidence = splitJoined(ticket.supporting_evidence);
            const counterEvidence = splitJoined(ticket.counter_evidence);
            const uncertaintyFlags = splitJoined(ticket.uncertainty_flags);
            const { critical: criticalFlags, warning: warningFlags } = splitUncertaintyFlags(uncertaintyFlags);

            return (
              <li key={ticket.ticket_id} className="tickets-view__item">
                <div className="tickets-view__row">
                  <div className="tickets-view__summary">
                    <span className="tickets-view__id">{ticket.ticket_id}</span>
                    <span className="tickets-view__order">Order {ticket.order_id}</span>
                    <span
                      className="tickets-view__decision"
                      style={{
                        color: decisionColor(ticket.decision),
                        background: `color-mix(in srgb, ${decisionColor(ticket.decision)} 14%, white)`,
                      }}
                    >
                      {formatDecision(ticket.decision)}
                    </span>
                    <span
                      className="tickets-view__risk"
                      style={{
                        color: riskColor(ticket.risk_level),
                        background: `color-mix(in srgb, ${riskColor(ticket.risk_level)} 14%, white)`,
                      }}
                    >
                      {ticket.risk_level} risk
                    </span>
                    <span className="tickets-view__confidence">{confidencePct} confidence</span>
                    <span className="tickets-view__created">{formatTimestamp(ticket.created_at)}</span>
                  </div>

                  {ticketsStatus === 'OPEN' && !isActive && (
                    <button
                      type="button"
                      ref={(el) => {
                        resolveButtonRefs.current[ticket.ticket_id] = el;
                      }}
                      className="tickets-view__resolve-btn"
                      onClick={() => openResolveForm(ticket.ticket_id)}
                      aria-label={`Resolve ticket ${ticket.ticket_id}`}
                    >
                      Resolve
                    </button>
                  )}
                </div>

                <p className="tickets-view__reason">{ticket.reason}</p>

                {ticketsStatus === 'RESOLVED' && (
                  <p className="tickets-view__resolution">
                    {ticket.resolution_outcome && (
                      <span
                        className={`tickets-view__outcome tickets-view__outcome--${ticket.resolution_outcome.toLowerCase()}`}
                      >
                        {RESOLUTION_OUTCOME_LABELS[ticket.resolution_outcome] || ticket.resolution_outcome}
                      </span>
                    )}
                    {' '}Resolved by <strong>{ticket.resolved_by || 'unknown'}</strong>
                    {ticket.resolved_at ? ` on ${formatTimestamp(ticket.resolved_at)}` : ''}
                    {ticket.resolution_note ? `: ${ticket.resolution_note}` : ''}
                  </p>
                )}

                {(ticket.narrative || supportingEvidence.length || counterEvidence.length || uncertaintyFlags.length) ? (
                  <details className="tickets-view__details">
                    <summary>Evidence &amp; narrative</summary>
                    <div className="tickets-view__details-body">
                      {ticket.narrative && <p className="tickets-view__narrative">{ticket.narrative}</p>}
                      <EvidenceList label="Supporting" items={supportingEvidence} />
                      <EvidenceList label="Counter" items={counterEvidence} />
                      <EvidenceList label="Critical" items={criticalFlags} tone="critical" />
                      <EvidenceList label="Uncertainty" items={warningFlags} />
                    </div>
                  </details>
                ) : null}

                {isActive && (
                  <form
                    className="tickets-view__resolve-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      confirmResolve(ticket.ticket_id);
                    }}
                  >
                    <p className="tickets-view__resolve-hint">
                      Confirm resolution for {ticket.ticket_id} - all fields are required.
                    </p>

                    <label htmlFor={`resolution-outcome-${ticket.ticket_id}`}>Outcome</label>
                    <select
                      id={`resolution-outcome-${ticket.ticket_id}`}
                      value={resolveForm.resolutionOutcome}
                      onChange={handleFormChange('resolutionOutcome')}
                      required
                      aria-required="true"
                      disabled={isResolving}
                    >
                      <option value="" disabled>
                        Choose an outcome…
                      </option>
                      {RESOLUTION_OUTCOMES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <label htmlFor={`resolved-by-${ticket.ticket_id}`}>Resolved by</label>
                    <input
                      id={`resolved-by-${ticket.ticket_id}`}
                      ref={resolvedByInputRef}
                      value={resolveForm.resolvedBy}
                      onChange={handleFormChange('resolvedBy')}
                      placeholder="Your name"
                      required
                      aria-required="true"
                      disabled={isResolving}
                    />

                    <label htmlFor={`resolution-note-${ticket.ticket_id}`}>Resolution note</label>
                    <textarea
                      id={`resolution-note-${ticket.ticket_id}`}
                      value={resolveForm.resolutionNote}
                      onChange={handleFormChange('resolutionNote')}
                      placeholder="What did you check, and why is this resolved?"
                      required
                      aria-required="true"
                      disabled={isResolving}
                      rows={2}
                    />

                    {rowError && (
                      <p className="tickets-view__resolve-error" role="alert">
                        {rowError}
                      </p>
                    )}

                    <div className="tickets-view__resolve-actions">
                      <button type="submit" disabled={!canConfirm || isResolving}>
                        {isResolving ? 'Resolving…' : 'Confirm resolve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelResolveForm(ticket.ticket_id)}
                        disabled={isResolving}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="tickets-view__pagination" aria-label="Tickets pages">
          <button
            type="button"
            onClick={() => loadTickets({ targetPage: page - 1 })}
            disabled={page <= 1 || listLoading || refreshing}
          >
            Prev
          </button>

          {windowedPageNumbers(page, totalPages).map((entry, index) =>
            entry === '…' ? (
              <span key={`ellipsis-${index}`} className="tickets-view__pagination-ellipsis">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                className={entry === page ? 'is-active' : ''}
                aria-current={entry === page ? 'page' : undefined}
                onClick={() => loadTickets({ targetPage: entry })}
                disabled={listLoading || refreshing}
              >
                {entry}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => loadTickets({ targetPage: page + 1 })}
            disabled={page >= totalPages || listLoading || refreshing}
          >
            Next
          </button>

          <span className="tickets-view__pagination-summary">
            Page {page} of {totalPages} ({total} {statusTab.toLowerCase()})
          </span>
        </nav>
      )}
    </div>
  );
}

function EvidenceList({ label, items, tone }) {
  if (items.length === 0) return null;
  return (
    <div className="tickets-view__evidence-group">
      <span className="tickets-view__evidence-label">{label}</span>
      <ul className="tickets-view__evidence-list">
        {items.map((item, index) => (
          <li key={index} className={tone === 'critical' ? 'is-critical' : undefined}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
