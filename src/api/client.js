// Thin fetch wrapper over the FastAPI backend (task 05). No reshaping of
// response data happens here - every function resolves to the JSON body
// exactly as the backend sends it, matching the shapes in
// docs/tasks/06-react-frontend.md / src/api.py & src/investigation_agent.py
// in the backend repo. Components read fields directly off what these
// functions return.
//
// Plain fetch, not axios: zero extra dependency for a handful of simple
// JSON endpoints against one backend, no interceptor/cancellation needs
// this demo requires.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/** Drops undefined/null values so callers can omit optional filters. */
function buildQuery(params) {
  const usp = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      usp.set(key, value);
    }
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Formats a backend `detail` value into a readable string. Usually a
 * plain string, but FastAPI's default validation-error shape (most
 * 422s) is an array of `{ loc, msg, type }` objects - map that into a
 * short "field: message" summary instead of showing the raw JSON blob.
 */
function formatDetail(detail) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((entry) => {
        const field = Array.isArray(entry?.loc) ? entry.loc.slice(1).join('.') : '';
        const msg = entry?.msg || JSON.stringify(entry);
        return field ? `${field}: ${msg}` : msg;
      })
      .join('; ');
  }
  return JSON.stringify(detail);
}

/**
 * Shared request helper. Throws `Error(detail)` on any non-2xx response
 * (the backend's error body is `{ detail: string }`, or FastAPI's
 * validation-error array shape) so callers can `catch (err)` and show
 * `err.message` directly.
 */
async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
  } catch (networkErr) {
    throw new Error(`Network error reaching backend: ${networkErr.message}`);
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    // No JSON body (e.g. some 204/500s) - leave body as null.
  }

  if (!res.ok) {
    const detail = (body && body.detail) || res.statusText || `HTTP ${res.status}`;
    throw new Error(formatDetail(detail));
  }

  return body;
}

/**
 * GET /orders?scenario=&limit=&offset=
 * @param {{ scenario?: string, limit?: number, offset?: number }} [params]
 * @returns {Promise<import('../types').OrderSummary[]>}
 */
export function getOrders(params = {}) {
  const { scenario, limit, offset } = params;
  return request(`/orders${buildQuery({ scenario, limit, offset })}`);
}

/**
 * GET /orders/{order_id}/investigate
 * @param {string} orderId
 * @returns {Promise<import('../types').InvestigationReport>}
 */
export function getOrderInvestigation(orderId) {
  return request(`/orders/${encodeURIComponent(orderId)}/investigate`);
}

/**
 * POST /investigate
 * @param {import('../types').AdHocOrderPayload} payload
 * @returns {Promise<import('../types').InvestigationReport>}
 */
export function postInvestigate(payload) {
  return request('/investigate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * GET /insights?min_sample=&delta_threshold=
 * @param {{ minSample?: number, deltaThreshold?: number }} [params]
 * @returns {Promise<import('../types').OperationalInsight[]>}
 */
export function getInsights(params = {}) {
  const { minSample, deltaThreshold } = params;
  return request(`/insights${buildQuery({ min_sample: minSample, delta_threshold: deltaThreshold })}`);
}

/**
 * GET /tickets?status=OPEN
 * @param {{ status?: string }} [params]
 * @returns {Promise<import('../types').TicketRow[]>}
 */
export function getTickets(params = {}) {
  const { status } = params;
  return request(`/tickets${buildQuery({ status })}`);
}

/**
 * POST /tickets/{ticket_id}/resolve
 * @param {string} ticketId
 * @param {{ resolvedBy: string, resolutionNote: string }} body
 * @returns {Promise<{ ticket_id: string, status: string, resolved_by: string, resolution_note: string }>}
 */
export function resolveTicket(ticketId, { resolvedBy, resolutionNote }) {
  return request(`/tickets/${encodeURIComponent(ticketId)}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolved_by: resolvedBy, resolution_note: resolutionNote }),
  });
}
