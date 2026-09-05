import { useId, useRef, useState } from 'react';
import './AdHocOrderForm.css';

const EMPTY_FORM = {
  customer_id: '',
  pincode: '',
  courier_id: '',
  order_value: '',
  order_id: '',
  seller_id: '',
  product_category: '',
  cod_amount: '',
  payment_type: '',
  is_first_order: '',
  address_verified: '',
};

// Real category values confirmed in the backend's synthetic data generator
// (src/data_generator.py PRODUCT_CATEGORIES) — offered as <datalist>
// suggestions, not a locked <select>, since product_category is an open
// Optional[str] on the wire and any value should still be sendable.
const PRODUCT_CATEGORIES = [
  'Electronics',
  'Fashion',
  'Beauty',
  'Home',
  'Kitchen',
  'Mobile_Accessories',
  'Footwear',
  'Grocery',
  'Sports',
  'Personal_Care',
];

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

  if (
    form.cod_amount.trim() !== '' &&
    (!Number.isFinite(Number(form.cod_amount)) || Number(form.cod_amount) < 0)
  ) {
    errors.cod_amount = 'COD amount must be a non-negative number.';
  }

  return errors;
}

/** Builds the AdHocOrderPayload, omitting optional fields left blank so the
 * backend sees them as genuinely absent rather than empty strings. pincode
 * is sent as the raw string entered — the backend coerces string|number,
 * so no client-side coercion happens here. */
function buildPayload(form) {
  const payload = {
    customer_id: form.customer_id.trim(),
    pincode: form.pincode.trim(),
    courier_id: form.courier_id.trim(),
    order_value: Number(form.order_value),
  };
  if (form.order_id.trim()) payload.order_id = form.order_id.trim();
  if (form.seller_id.trim()) payload.seller_id = form.seller_id.trim();
  if (form.product_category.trim()) payload.product_category = form.product_category.trim();
  if (form.cod_amount.trim() !== '') payload.cod_amount = Number(form.cod_amount);
  if (form.payment_type.trim()) payload.payment_type = form.payment_type.trim();
  if (form.is_first_order !== '') payload.is_first_order = form.is_first_order === 'true';
  if (form.address_verified !== '') payload.address_verified = form.address_verified === 'true';
  return payload;
}

/**
 * GROUP 1 (pairs with OrderPicker) — owns this file + AdHocOrderForm.css only.
 *
 * Free-entry customer_id / pincode / courier_id / order_value (any of
 * which may not exist in the dataset), plus a collapsed "advanced" section
 * for the remaining optional AdHocOrderPayload fields. Submits via
 * `onSubmit(payload)` — App owns the actual POST /investigate call and
 * resulting shared `currentInvestigation`, so this component only
 * collects the form, validates it client-side, and hands off a plain
 * payload object. Works identically for a brand-new customer or one that
 * already exists — no client-side lookup against the dataset, the
 * backend decides that; the validation here is format-only (required
 * fields present, order_value/cod_amount numeric).
 *
 * The form is intentionally NOT cleared after a successful submit — an
 * ad-hoc investigation is often re-run with one field tweaked (e.g.
 * toggling address_verified) to see how the decision changes, and
 * clearing would throw that away. `submitting` (shared with App, since
 * App also owns whatever the submission produces) disables every field
 * and the submit button and relabels it, which is the only feedback this
 * isolated component can give about an in-flight submission.
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
      const firstInvalid = REQUIRED_FIELD_ORDER.find((field) => nextErrors[field]) || 'cod_amount';
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

        <details className="adhoc-form__advanced">
          <summary>Advanced fields (optional)</summary>
          <div className="adhoc-form__grid">
            <div className="adhoc-form__field">
              <label htmlFor={fieldId('order_id')}>Order ID</label>
              <input
                id={fieldId('order_id')}
                value={form.order_id}
                onChange={handleChange('order_id')}
                disabled={submitting}
              />
            </div>

            <div className="adhoc-form__field">
              <label htmlFor={fieldId('seller_id')}>Seller ID</label>
              <input
                id={fieldId('seller_id')}
                value={form.seller_id}
                onChange={handleChange('seller_id')}
                disabled={submitting}
              />
            </div>

            <div className="adhoc-form__field">
              <label htmlFor={fieldId('product_category')}>Product category</label>
              <input
                id={fieldId('product_category')}
                list={fieldId('product_category_options')}
                value={form.product_category}
                onChange={handleChange('product_category')}
                disabled={submitting}
              />
              <datalist id={fieldId('product_category_options')}>
                {PRODUCT_CATEGORIES.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>

            <div className="adhoc-form__field">
              <label htmlFor={fieldId('cod_amount')}>COD amount</label>
              <input
                id={fieldId('cod_amount')}
                ref={(el) => {
                  fieldRefs.current.cod_amount = el;
                }}
                type="number"
                min="0"
                step="0.01"
                value={form.cod_amount}
                onChange={handleChange('cod_amount')}
                aria-invalid={Boolean(errors.cod_amount)}
                aria-describedby={errors.cod_amount ? `${fieldId('cod_amount')}-error` : undefined}
                disabled={submitting}
              />
              {errors.cod_amount && (
                <p className="adhoc-form__error" id={`${fieldId('cod_amount')}-error`} role="alert">
                  {errors.cod_amount}
                </p>
              )}
            </div>

            <div className="adhoc-form__field">
              <label htmlFor={fieldId('payment_type')}>Payment type</label>
              <input
                id={fieldId('payment_type')}
                list={fieldId('payment_type_options')}
                value={form.payment_type}
                onChange={handleChange('payment_type')}
                disabled={submitting}
              />
              <datalist id={fieldId('payment_type_options')}>
                <option value="COD" />
              </datalist>
            </div>

            <div className="adhoc-form__field">
              <label htmlFor={fieldId('is_first_order')}>First order?</label>
              <select
                id={fieldId('is_first_order')}
                value={form.is_first_order}
                onChange={handleChange('is_first_order')}
                disabled={submitting}
              >
                <option value="">Unspecified</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div className="adhoc-form__field">
              <label htmlFor={fieldId('address_verified')}>Address verified?</label>
              <select
                id={fieldId('address_verified')}
                value={form.address_verified}
                onChange={handleChange('address_verified')}
                disabled={submitting}
              >
                <option value="">Unspecified</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
        </details>

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
