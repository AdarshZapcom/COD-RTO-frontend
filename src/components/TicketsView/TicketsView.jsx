import { useEffect, useRef, useState } from 'react';
import { getTickets, resolveTicket } from '../../api/client';
import { decisionColor, riskColor, formatDecision, splitUncertaintyFlags } from '../../lib/format.js';
import { windowedPageNumbers } from '../../lib/pagination.js';
import { TicketIcon } from '../icons/Icon.jsx';
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

const EMPTY_RESOLVE_FORM = { resolvedBy: '', resolutionNote: '' };

// A live event/stress-test run can accumulate hundreds of ad hoc
// tickets, so this view needs real numbered pagination against the
// backend's limit/offset support. Kept small (7) so a page of
// evidence-heavy ticket cards stays scannable without much scrolling.
const PAGE_SIZE = 7;

/**
 * GROUP 5 (pairs with InsightsStrip) - owns this file + TicketsView.css only.
 *
 * GET /tickets?status=OPEN, with a resolve action (POST
 * /tickets/{id}/resolve). Fully self-contained - fetches its own data
 * on mount (and on manual refresh), independent of `currentInvestigation`
 * and every other component.
 *
 * Resolving is destructive (closes the escalation) and the backend
 * requires a real `resolved_by` / `resolution_note`, so "Resolve" does
 * not call the API directly - it reveals an inline confirm form
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

    if (isRefresh) setRefreshing(true);
    else setListLoading(true);
    setListError(null);

    getTickets({ status: 'OPEN', limit: PAGE_SIZE, offset: (targetPage - 1) * PAGE_SIZE })
      .then(({ tickets: data, total: totalCount }) => {
        if (!mountedRef.current || requestIdRef.current !== requestId) return;
        setTickets(data);
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

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!resolvedBy || !resolutionNote) return;

    setResolvingId(ticketId);
    setResolveErrors((prev) => ({ ...prev, [ticketId]: null }));
    try {
      await resolveTicket(ticketId, { resolvedBy, resolutionNote });
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

  const canConfirm = resolveForm.resolvedBy.trim() !== '' && resolveForm.resolutionNote.trim() !== '';

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
          Open tickets
        </h2>
        <button
          type="button"
          className="tickets-view__refresh"
          onClick={() => loadTickets({ isRefresh: true })}
          disabled={listLoading || refreshing}
          aria-label="Refresh open tickets"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="tickets-view__status" aria-live="polite">
        {listLoading && <p className="empty-state">Loading open tickets…</p>}

        {!listLoading && listError && (
          <div className="tickets-view__error" role="alert">
            <span>{listError}</span>
            <button type="button" onClick={() => loadTickets()}>
              Retry
            </button>
          </div>
        )}

        {!listLoading && !listError && tickets.length === 0 && (
          <p className="empty-state">No open tickets - all clear.</p>
        )}
      </div>

      {!listLoading && !listError && tickets.length > 0 && (
        <ul className="tickets-view__list" aria-busy={refreshing}>
          {tickets.map((ticket) => {
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

                  {!isActive && (
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
                      Confirm resolution for {ticket.ticket_id} - both fields are required.
                    </p>

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
            Page {page} of {totalPages} ({total} open)
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
