// Shared JSDoc typedefs mirroring the backend's Pydantic models exactly
// (src/api.py, src/investigation_agent.py, src/operational_insights.py,
// src/ticketing.py in the backend repo). No runtime code — plain JS
// project, these exist purely so every component can `@param`/`@type`
// against one agreed shape instead of components re-describing the
// contract ad hoc. Keep in sync with the backend if it changes; nothing
// here should ever diverge from the real response.

/**
 * @typedef {Object} OrderSummary
 * @property {string} order_id
 * @property {string} [customer_id]
 * @property {string} [pincode]
 * @property {string} [courier_id]
 * @property {number} [order_value]
 * @property {string} [scenario]
 * @property {string} [order_status]
 */

/**
 * @typedef {Object} AdHocOrderPayload
 * @property {string} customer_id
 * @property {string|number} pincode
 * @property {string} courier_id
 * @property {number} order_value
 * @property {string} [order_id]
 * @property {string} [seller_id]
 * @property {string} [product_category]
 * @property {number} [cod_amount]
 * @property {string} [payment_type]
 * @property {boolean} [is_first_order]
 * @property {boolean} [address_verified]
 */

/**
 * @typedef {Object} TimingBreakdown
 * @property {number} evidence_ms
 * @property {number} decision_ms
 * @property {number} retrieval_ms
 * @property {number} narrative_ms
 */

/**
 * @typedef {Object} InvestigationReport
 * @property {string} order_id
 * @property {'RELEASE'|'HOLD_FOR_VERIFICATION'|'ESCALATE'} decision
 * @property {'LOW'|'MEDIUM'|'HIGH'} risk_level
 * @property {number} confidence - 0-1
 * @property {string} reason
 * @property {string[]} supporting_evidence
 * @property {string[]} counter_evidence
 * @property {string[]} uncertainty_flags
 * @property {string} narrative
 * @property {'llm'|'template_fallback'} narrative_source
 * @property {string|null} advisory_flag
 * @property {string|null} most_relevant_case_id
 * @property {string[]} retrieved_case_ids
 * @property {TimingBreakdown} timing_ms
 * @property {string|null} ticket_id
 */

/**
 * @typedef {Object} OperationalInsight
 * @property {string} courier_id
 * @property {string} pincode
 * @property {'HIGH'|'MEDIUM'|'LOW_SAMPLE'} severity
 * @property {number} rto_rate_7d
 * @property {number} rto_rate_30d
 * @property {number} delta
 * @property {number} sample_size
 * @property {string|null} possible_cause
 * @property {string} recommended_action
 */

/**
 * @typedef {Object} TicketRow
 * @property {string} ticket_id
 * @property {string} order_id
 * @property {string} decision
 * @property {string} risk_level
 * @property {number} confidence
 * @property {string} reason
 * @property {string} supporting_evidence - " | "-joined, NOT an array (raw ticket table row)
 * @property {string} counter_evidence - " | "-joined, NOT an array
 * @property {string} uncertainty_flags - " | "-joined, NOT an array
 * @property {string} narrative
 * @property {string} created_at
 * @property {string} status
 * @property {string|null} resolved_by
 * @property {string|null} resolution_note
 * @property {string|null} resolved_at
 */

export {};
