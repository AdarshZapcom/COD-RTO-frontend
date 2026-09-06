import { useId, useRef, useState } from 'react';
import './AdHocOrderForm.css';

const EMPTY_FORM = {
  customer_id: '',
  pincode: '',
  courier_id: '',
  order_value: '',
};

// Order the four *required* fields visually appear in, used to focus the
// first invalid one on a failed submit.
const REQUIRED_FIELD_ORDER = ['customer_id', 'pincode', 'courier_id', 'order_value'];

function validate(form) {
  const errors = {};

  if (!form.customer_id.trim()) errors.customer_id = 'Customer ID is required.';

  if (!form.pincode.trim()) {
    errors.pincode = 'Pincode is required.';
  } else if (!/^\d+$/.test(form.pincode.trim())) {
    errors.pincode = 'Pincode should contain digits only.';
  }

  if (!form.courier_id.trim()) errors.courier_id = 'Courier ID is required.';

  if (form.order_value.trim() === '') {
    errors.order_value = 'Order value is required.';
  } else if (!Number.isFinite(Number(form.order_value)) || Number(form.order_value) <= 0) {
    errors.order_value = 'Order value must be a number greater than 0.';
  }

  return errors;
}

/** Builds the AdHocOrderPayload. pincode is sent as the raw string entered —
 * the backend coerces string|number, so no client-side coercion happens
 * here. order_id is left for the backend to generate (a synthetic
 * "ADHOC-<timestamp>" id) rather than collected here - see buildPayload's
 * removed advanced-fields note below for why the rest were dropped. */
function buildPayload(form) {
  return {
    customer_id: form.customer_id.trim(),
    pincode: form.pincode.trim(),
    courier_id: form.courier_id.trim(),
    order_value: Number(form.order_value),
  };
}

/**
 * GROUP 1 (pairs with OrderPicker) — owns this file + AdHocOrderForm.css only.
 *
 * Free-entry customer_id / pincode / courier_id / order_value (any of
 * which may not exist in the dataset) — the only four fields that
 * actually reach the decision. This used to also collect order_id,
 * seller_id, product_category, cod_amount, payment_type,
 * is_first_order and address_verified behind a collapsed "advanced"
 * section, but none of them were ever read by compare_signals(),
 * decide(), or even the LLM narrative prompt - confirmed by grepping
 * the backend, not assumed - so they were pure dead input and removed
 * rather than left to imply a capability that doesn't exist.
 * Submits via `onSubmit(payload)` — App owns the actual POST
 * /investigate call and resulting shared `currentInvestigation`, so
 * this component only collects the form, validates it client-side, and
 * hands off a plain payload object. Works identically for a brand-new
 * customer or one that already exists — no client-side lookup against
 * the dataset, the backend decides that; the validation here is
 * format-only (required fields present, order_value numeric).
 *
 * The form is intentionally NOT cleared after a successful submit — an
 * ad-hoc investigation is often re-run with one field tweaked to see
 * how the decision changes, and clearing would throw that away.
 * `submitting` (shared with App, since App also owns whatever the
 * submission produces) disables every field and the submit button and
 * relabels it, which is the only feedback this isolated component can
 * give about an in-flight submission.
 *
 * @param {{ onSubmit: (payload: import('../../types').AdHocOrderPayload) => void, submitting: boolean }} props
 */
export default function AdHocOrderForm({ onSubmit, submitting }) {
  const uid = useId();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const fieldRefs = useRef({});

  function fieldId(name) {
    return `${uid}-${name}`;
  }

  function handleChange(field) {
    return (event) => {
      const { value } = event.target;
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    };
  }

  function handleReset() {
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validate(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const firstInvalid = REQUIRED_FIELD_ORDER.find((field) => nextErrors[field]);
      fieldRefs.current[firstInvalid]?.focus();
      return;
    }

    onSubmit(buildPayload(form));
  }

  return (
    <div className="panel adhoc-form">
      <h2>Ad-hoc order</h2>
      <p className="adhoc-form__hint">
        Enter any customer / pincode / courier combination — new or existing — and submit to run a
        live investigation against it.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="adhoc-form__grid">
          <div className="adhoc-form__field">
            <label htmlFor={fieldId('customer_id')}>Customer ID *</label>
            <input
              id={fieldId('customer_id')}
              ref={(el) => {
                fieldRefs.current.customer_id = el;
              }}
              value={form.customer_id}
              onChange={handleChange('customer_id')}
              aria-required="true"
              aria-invalid={Boolean(errors.customer_id)}
              aria-describedby={errors.customer_id ? `${fieldId('customer_id')}-error` : undefined}
              disabled={submitting}
            />
            {errors.customer_id && (
              <p className="adhoc-form__error" id={`${fieldId('customer_id')}-error`} role="alert">
                {errors.customer_id}
              </p>
            )}
          </div>

          <div className="adhoc-form__field">
            <label htmlFor={fieldId('pincode')}>Pincode *</label>
            <input
              id={fieldId('pincode')}
              ref={(el) => {
                fieldRefs.current.pincode = el;
              }}
              value={form.pincode}
              onChange={handleChange('pincode')}
              inputMode="numeric"
              aria-required="true"
              aria-invalid={Boolean(errors.pincode)}
              aria-describedby={errors.pincode ? `${fieldId('pincode')}-error` : undefined}
              disabled={submitting}
            />
            {errors.pincode && (
              <p className="adhoc-form__error" id={`${fieldId('pincode')}-error`} role="alert">
                {errors.pincode}
              </p>
            )}
          </div>

          <div className="adhoc-form__field">
            <label htmlFor={fieldId('courier_id')}>Courier ID *</label>
            <input
              id={fieldId('courier_id')}
              ref={(el) => {
                fieldRefs.current.courier_id = el;
              }}
              value={form.courier_id}
              onChange={handleChange('courier_id')}
              aria-required="true"
              aria-invalid={Boolean(errors.courier_id)}
              aria-describedby={errors.courier_id ? `${fieldId('courier_id')}-error` : undefined}
              disabled={submitting}
            />
            {errors.courier_id && (
              <p className="adhoc-form__error" id={`${fieldId('courier_id')}-error`} role="alert">
                {errors.courier_id}
              </p>
            )}
          </div>

          <div className="adhoc-form__field">
            <label htmlFor={fieldId('order_value')}>Order value *</label>
            <input
              id={fieldId('order_value')}
              ref={(el) => {
                fieldRefs.current.order_value = el;
              }}
              type="number"
              min="0.01"
              step="0.01"
              value={form.order_value}
              onChange={handleChange('order_value')}
              aria-required="true"
              aria-invalid={Boolean(errors.order_value)}
              aria-describedby={errors.order_value ? `${fieldId('order_value')}-error` : undefined}
              disabled={submitting}
            />
            {errors.order_value && (
              <p className="adhoc-form__error" id={`${fieldId('order_value')}-error`} role="alert">
                {errors.order_value}
              </p>
            )}
          </div>
        </div>

        <div className="adhoc-form__actions">
          <button type="button" className="adhoc-form__reset" onClick={handleReset} disabled={submitting}>
            Reset
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Investigating…' : 'Investigate'}
          </button>
        </div>
      </form>
    </div>
  );
}
