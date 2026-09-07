/**
 * End-to-end scenario suite for the COD/RTO investigation demo.
 *
 * Encodes docs/business-scenarios.md sections A (core decision scenarios),
 * B (the 10 regression bugs fixed for this feature), and E (input-format
 * robustness) as runnable Playwright checks against a REAL, running
 * backend + frontend. No mocking — this drives an actual Chromium browser
 * against the app and makes real HTTP requests for the API-only cases.
 *
 * Prerequisites (not started by this script):
 *   - Backend:  uvicorn src.api:app --port 8000   (from the qwerty repo)
 *   - Frontend: npm run dev                         (from this repo, port 5173)
 *
 * Run:
 *   node tests/e2e/scenarios.spec.cjs
 *   BASE_URL=http://localhost:5173 API_URL=http://localhost:8000 node tests/e2e/scenarios.spec.cjs
 *
 * No test-runner dependency (no @playwright/test) — plain `playwright`
 * (already a devDependency, Chromium already downloaded) driven
 * imperatively with a minimal test()/assert() harness below. Exits 0 if
 * every case passes, 1 otherwise (CI-friendly).
 *
 * .cjs extension (not .js): this package.json has "type": "module", so a
 * plain .js file is loaded as ESM and `require()` fails - .cjs opts this
 * one file back into CommonJS regardless of that setting.
 */

const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:8000';

// ------------------------------------------------------------------
// Minimal test harness
// ------------------------------------------------------------------

const results = [];

async function test(name, fn) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, status: 'PASS', ms: Date.now() - start });
    console.log(`PASS  (${Date.now() - start}ms)  ${name}`);
  } catch (err) {
    results.push({ name, status: 'FAIL', ms: Date.now() - start, error: err.message });
    console.log(`FAIL  (${Date.now() - start}ms)  ${name}`);
    console.log(`      ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function assertEqual(actual, expected, label) {
  assert(actual === expected, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ------------------------------------------------------------------
// App-driving helpers
// ------------------------------------------------------------------

async function selectOrderById(page, orderId) {
  // ORD-10000..10009 are the first rows generated (before any bulk
  // background orders) so they're always on OrderPicker's first page
  // (default "All scenarios" filter, no need to page/search).
  const row = page.locator('.order-picker__list button', { hasText: orderId }).first();
  await row.waitFor({ state: 'visible', timeout: 15000 });

  // Wait for THIS order's own GET .../investigate response, not just
  // "the banner is visible" - the banner may already be visible from a
  // previously-selected order on the same page, which would resolve
  // instantly and read stale content before the new fetch completes.
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes(`/orders/${orderId}/investigate`) && res.request().method() === 'GET',
    { timeout: 15000 },
  );
  await row.click();
  await responsePromise;
  // Let React finish committing the new state to the DOM.
  await page.waitForTimeout(150);
}

function decisionText(page) {
  return page.locator('.decision-banner__decision').innerText();
}

function reasonText(page) {
  return page.locator('.decision-banner__reason').innerText();
}

function confidenceText(page) {
  return page.locator('.decision-banner__confidence').innerText();
}

async function counterEvidenceItems(page) {
  return page.locator('.evidence-comparison__column--counter li').allInnerTexts();
}

async function hasDataNotAvailable(page) {
  const text = await page.locator('body').innerText();
  return /data not available/i.test(text);
}

const adhocForm = (page) => page.locator('.adhoc-form');

async function fillByLabel(page, labelText, value) {
  const label = adhocForm(page).locator('label', { hasText: labelText }).first();
  const forId = await label.getAttribute('for');
  assert(forId, `no label found for "${labelText}"`);
  await page.fill(`[id="${forId}"]`, value);
}

async function selectByLabel(page, labelText, value) {
  const label = adhocForm(page).locator('label', { hasText: labelText }).first();
  const forId = await label.getAttribute('for');
  assert(forId, `no label found for "${labelText}"`);
  await page.selectOption(`[id="${forId}"]`, value);
}

/**
 * Fills and submits the ad-hoc form, waiting for the resulting
 * POST /investigate response. Returns the response status.
 * `opts.addressVerified` / `opts.isFirstOrder`: 'true' | 'false' | undefined
 * (undefined leaves the advanced dropdown at "Unspecified").
 */
async function submitAdHoc(page, { customerId, pincode, courierId, orderValue, addressVerified, isFirstOrder }) {
  await fillByLabel(page, 'Customer ID', customerId);
  await fillByLabel(page, 'Pincode', pincode);
  await fillByLabel(page, 'Courier ID', courierId);
  await fillByLabel(page, 'Order value', String(orderValue));

  if (addressVerified !== undefined || isFirstOrder !== undefined) {
    const details = adhocForm(page).locator('details.adhoc-form__advanced');
    const isOpen = await details.evaluate((el) => el.open);
    if (!isOpen) await adhocForm(page).locator('summary').click();
  }
  if (addressVerified !== undefined) await selectByLabel(page, 'Address verified?', addressVerified);
  if (isFirstOrder !== undefined) await selectByLabel(page, 'First order?', isFirstOrder);

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes('/investigate') && res.request().method() === 'POST',
    { timeout: 15000 },
  );
  await adhocForm(page).locator('button[type="submit"]').click();
  const response = await responsePromise;
  await page.locator('.decision-banner').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  return response.status();
}

async function resetForm(page) {
  await adhocForm(page).locator('button:has-text("Reset")').click();
}

// ------------------------------------------------------------------
// Direct-API helpers (for cases not reachable/meaningful through the UI)
// ------------------------------------------------------------------

async function postInvestigateRaw(bodyString) {
  const res = await fetch(`${API_URL}/investigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bodyString,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function postResolveTicket(ticketId) {
  const res = await fetch(`${API_URL}/tickets/${ticketId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolved_by: 'qa-suite', resolution_note: 'automated scenario check' }),
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

// ------------------------------------------------------------------
// Section A — core decision scenarios (dataset orders)
// ------------------------------------------------------------------

const CORE_SCENARIOS = [
  { id: 'A1', orderId: 'ORD-10000', expected: 'RELEASE' },
  { id: 'A2', orderId: 'ORD-10001', expected: 'HOLD_FOR_VERIFICATION' },
  { id: 'A3', orderId: 'ORD-10002', expected: 'HOLD_FOR_VERIFICATION' },
  { id: 'A4', orderId: 'ORD-10003', expected: 'HOLD_FOR_VERIFICATION' },
  { id: 'A5', orderId: 'ORD-10004', expected: 'ESCALATE' },
  { id: 'A6', orderId: 'ORD-10005', expected: 'HOLD_FOR_VERIFICATION' },
  { id: 'A7', orderId: 'ORD-10006', expected: 'ESCALATE' },
  { id: 'A8', orderId: 'ORD-10007', expected: 'HOLD_FOR_VERIFICATION' },
  { id: 'A9', orderId: 'ORD-10008', expected: 'HOLD_FOR_VERIFICATION' },
  { id: 'A10', orderId: 'ORD-10009', expected: 'ESCALATE' },
];

// ------------------------------------------------------------------
// Main run
// ------------------------------------------------------------------

async function main() {
  const browser = await chromium.launch();
  const consoleErrors = [];

  async function freshPage() {
    const page = await browser.newPage();
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`); });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    return page;
  }

  // --- Section A: core scenarios ---
  for (const s of CORE_SCENARIOS) {
    await test(`[${s.id}] ${s.orderId} -> ${s.expected}`, async () => {
      const page = await freshPage();
      try {
        await selectOrderById(page, s.orderId);
        const decision = (await decisionText(page)).trim();
        assertEqual(decision, s.expected, `${s.orderId} decision`);
      } finally {
        await page.close();
      }
    });
  }

  // --- B1: numpy-bool verified evidence ---
  await test('[B1] ORD-10000 (CUST-001) shows verified counter-evidence + high RELEASE confidence', async () => {
    const page = await freshPage();
    try {
      await selectOrderById(page, 'ORD-10000');
      const counter = await counterEvidenceItems(page);
      assert(counter.some((t) => /phone number is verified/i.test(t)), 'missing "Phone number is verified"');
      assert(counter.some((t) => /address is verified/i.test(t)), 'missing "Address is verified"');
      const conf = await confidenceText(page);
      const pct = parseInt(conf.replace(/[^0-9]/g, ''), 10);
      assert(pct >= 85, `expected RELEASE confidence >= 85%, got "${conf}"`);
    } finally {
      await page.close();
    }
  });

  // --- B2: NaN/-Infinity/Infinity order_value -> clean 422, not raw 500 ---
  for (const bad of ['NaN', '-Infinity', 'Infinity']) {
    await test(`[B2] order_value=${bad} -> clean 422`, async () => {
      const body = `{"customer_id":"CUST-001","pincode":"560001","courier_id":"C01","order_value": ${bad}}`;
      const { status, json } = await postInvestigateRaw(body);
      assertEqual(status, 422, `status for order_value=${bad}`);
      assert(json && Array.isArray(json.detail), `expected structured {"detail": [...]}, got ${JSON.stringify(json)}`);
    });
  }
  await test('[B2] order_value=0 -> clean 422', async () => {
    const { status, json } = await postInvestigateRaw(
      '{"customer_id":"CUST-001","pincode":"560001","courier_id":"C01","order_value": 0}',
    );
    assertEqual(status, 422, 'status for order_value=0');
    assert(json && Array.isArray(json.detail), 'expected structured detail array');
  });
  await test('[B2] valid order_value=500 -> 200', async () => {
    const { status } = await postInvestigateRaw(
      '{"customer_id":"CUST-001","pincode":"560001","courier_id":"C01","order_value": 500}',
    );
    assertEqual(status, 200, 'status for valid order_value');
  });

  // --- B4: ID normalization ---
  await test('[B4] lowercase customer_id "cust-001" resolves CUST-001', async () => {
    const page = await freshPage();
    try {
      await submitAdHoc(page, { customerId: 'cust-001', pincode: '560001', courierId: 'C01', orderValue: 500 });
      assert(!(await hasDataNotAvailable(page)), 'unexpected "data not available" for lowercase customer_id');
    } finally {
      await page.close();
    }
  });
  await test('[B4] whitespace-padded customer_id " CUST-001 " resolves CUST-001', async () => {
    const page = await freshPage();
    try {
      await submitAdHoc(page, { customerId: ' CUST-001 ', pincode: '560001', courierId: 'C01', orderValue: 500 });
      assert(!(await hasDataNotAvailable(page)), 'unexpected "data not available" for padded customer_id');
    } finally {
      await page.close();
    }
  });

  // --- B5: pincode float-suffix string, reachable through the real form ---
  await test('[B5] pincode "560001.0" resolves through the UI (not blocked by client validation)', async () => {
    const page = await freshPage();
    try {
      const status = await submitAdHoc(page, { customerId: 'CUST-001', pincode: '560001.0', courierId: 'C01', orderValue: 500 });
      assertEqual(status, 200, 'POST /investigate status');
      assert(!(await hasDataNotAvailable(page)), '"data not available" shown for float-suffixed pincode');
    } finally {
      await page.close();
    }
  });

  // --- B6: order-history depth changes confidence ---
  await test('[B6] deep-history customer vs. near-zero-history customer have different confidence', async () => {
    const page = await freshPage();
    try {
      await selectOrderById(page, 'ORD-10000'); // CUST-001, deep history
      const confDeep = await confidenceText(page);

      await selectOrderById(page, 'ORD-10004'); // NEW_EVERYTHING, near-zero history
      const confNew = await confidenceText(page);

      assert(confDeep !== confNew, `expected different confidence, both were "${confDeep}"`);
    } finally {
      await page.close();
    }
  });

  // --- B7: HIGH-risk reason is coherent (sanity, not exhaustive - unit-level already verified both branches) ---
  await test('[B7] ORD-10003 (HIGH risk) reason text is present and non-generic', async () => {
    const page = await freshPage();
    try {
      await selectOrderById(page, 'ORD-10003');
      const reason = await reasonText(page);
      assert(reason.length > 20, 'reason text unexpectedly short/empty');
      assert(!/undefined|null|NaN/i.test(reason), `reason text looks broken: "${reason}"`);
    } finally {
      await page.close();
    }
  });

  // --- B8: null byte in ticket_id -> 422, not 503 ---
  await test('[B8] null-byte ticket_id -> 422, not 503', async () => {
    const { status } = await postResolveTicket('TCK-doesnotexist%00');
    assertEqual(status, 422, 'status for null-byte ticket_id');
  });

  // --- B9: ad-hoc address_verified override actually changes evidence ---
  await test('[B9] CUST-005 with address_verified=No omits "Address is verified"', async () => {
    const page = await freshPage();
    try {
      await submitAdHoc(page, {
        customerId: 'CUST-005', pincode: '560009', courierId: 'C02', orderValue: 399, addressVerified: 'false',
      });
      const counter = await counterEvidenceItems(page);
      assert(!counter.some((t) => /address is verified/i.test(t)), 'override had no effect - "Address is verified" still present');
    } finally {
      await page.close();
    }
  });
  await test('[B9] CUST-005 with address_verified unspecified DOES show "Address is verified"', async () => {
    const page = await freshPage();
    try {
      await submitAdHoc(page, { customerId: 'CUST-005', pincode: '560009', courierId: 'C02', orderValue: 399 });
      const counter = await counterEvidenceItems(page);
      assert(counter.some((t) => /address is verified/i.test(t)), 'expected "Address is verified" with no override');
    } finally {
      await page.close();
    }
  });

  // --- B10: double-click submits exactly once ---
  await test('[B10] rapid double-click on Investigate fires exactly one POST /investigate', async () => {
    const page = await freshPage();
    try {
      await fillByLabel(page, 'Customer ID', 'CUST-001');
      await fillByLabel(page, 'Pincode', '560001');
      await fillByLabel(page, 'Courier ID', 'C01');
      await fillByLabel(page, 'Order value', '500');

      let count = 0;
      page.on('request', (req) => {
        if (req.url().includes('/investigate') && req.method() === 'POST') count += 1;
      });

      // Scoped to .adhoc-form: App.jsx's mode-switcher header ALSO has a
      // tab literally labeled "Investigate" (MODE_TABS) that sorts first
      // in DOM order - an unscoped textContent search matches that
      // instead of the form's own submit button.
      await page.evaluate(() => {
        const btn = document.querySelector('.adhoc-form button[type="submit"]');
        btn.click();
        btn.click();
      });

      await page.waitForTimeout(2000);
      assertEqual(count, 1, 'POST /investigate request count');
    } finally {
      await page.close();
    }
  });

  // --- Section E: input-format robustness spot-checks not already covered above ---
  await test('[E] pincode as bare int-like string "560001" still resolves (baseline)', async () => {
    const page = await freshPage();
    try {
      await submitAdHoc(page, { customerId: 'CUST-001', pincode: '560001', courierId: 'C01', orderValue: 500 });
      assert(!(await hasDataNotAvailable(page)), 'baseline pincode unexpectedly failed to resolve');
    } finally {
      await page.close();
    }
  });

  // --- General regression sweep ---
  await test('[Regression] Ops & tickets tab (InsightsStrip + TicketsView) loads without error', async () => {
    const page = await freshPage();
    try {
      await page.locator('button[role="tab"]:has-text("Ops & tickets")').click();
      await page.waitForTimeout(2000);
      const bodyText = await page.locator('body').innerText();
      assert(!/uncaught|exception|TypeError/i.test(bodyText), 'error text visible on Ops & tickets tab');
    } finally {
      await page.close();
    }
  });

  await browser.close();

  console.log('\n' + '='.repeat(70));
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`RESULTS: ${passed} passed, ${failed} failed, ${results.length} total`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const r of results.filter((r) => r.status === 'FAIL')) {
      console.log(`  - ${r.name}: ${r.error}`);
    }
  }
  if (consoleErrors.length > 0) {
    console.log(`\n${consoleErrors.length} browser console/page error(s) observed during the run:`);
    for (const e of consoleErrors.slice(0, 20)) console.log(`  - ${e}`);
  } else {
    console.log('\nNo browser console/page errors observed during the run.');
  }
  console.log('='.repeat(70));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('SUITE ERROR:', err);
  process.exit(1);
});
