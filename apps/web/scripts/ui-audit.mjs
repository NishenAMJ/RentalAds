// Start an isolated headless browser with --remote-debugging-port=9333 first.
// All auth/API requests are replaced with synthetic responses in this browser only.
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.UI_AUDIT_BASE ?? 'http://localhost:3000';
const output = 'D:/RentalAds/.tmp/perimeter-audit';
await mkdir(output, { recursive: true });
const tabs = await (await fetch('http://localhost:9333/json/list')).json();
const tab = tabs.find(tab => tab.type === 'page');
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0;
const pending = new Map();
socket.onmessage = event => {
  const result = JSON.parse(event.data);
  if (pending.has(result.id)) {
    const { resolve, reject, timeout } = pending.get(result.id);
    clearTimeout(timeout); pending.delete(result.id);
    if (result.error) reject(new Error(JSON.stringify(result.error))); else resolve(result.result);
  }
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const key = ++id;
    const timeout = setTimeout(() => { pending.delete(key); reject(new Error(`Timed out: ${method}`)); }, 20000);
    pending.set(key, { resolve, reject, timeout }); socket.send(JSON.stringify({ id: key, method, params }));
  });
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

function installFixtures() {
  const originalFetch = window.fetch.bind(window);
  const uid = '11111111-1111-4111-8111-111111111111';
  const lid = '22222222-2222-4222-8222-222222222222';
  const rid = '33333333-3333-4333-8333-333333333333';
  const now = new Date().toISOString();
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'ui-review@example.test', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: now };
  const listing = { id: lid, reference: 'SL-000001', propertyType: 'APARTMENT', size: 'TWO_BR', bedrooms: 2, bathrooms: 2, parking: true, furnishing: 'SEMI_FURNISHED', latitude: 6.927123, longitude: 79.861234, approximateLocation: { latitude: 6.9264, longitude: 79.8624 }, approximateDistanceKm: 0.15, areaText: 'Rajagiriya', mapLink: null, monthlyRent: 95000, minDurationMonths: 12, keyMoney: false, keyMoneyAmount: null, photoUrls: [], lastAvailabilityConfirmedAt: now, createdAt: now, status: 'ACTIVE', ownerContact: '+94710000000' };
  const request = { id: rid, searchLatitude: 6.9271, searchLongitude: 79.8612, searchRadiusKm: 3, areaText: 'Colombo 5, Nugegoda', budgetMin: 50000, budgetMax: 100000, durationMonths: 12, propertyType: 'APARTMENT', bedrooms: 2, renterContact: '+94710000000', status: 'OPEN', createdAt: now };
  const page = data => ({ data, page: 1, limit: 20, hasNextPage: false });
  const response = data => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const assessment = { areaMatched: true, requiresReview: false, matchPercentage: 88.2, differences: [], criteria: [
    { key: 'area', label: 'Area', status: 'matched', detail: 'Area matched: inside the selected perimeter.' },
    { key: 'budget', label: 'Budget', status: 'matched', detail: 'LKR 95,000; up to LKR 100,000 requested.' },
    { key: 'propertyType', label: 'Property type', status: 'matched', detail: 'Apartment offered and requested.' }
  ] };
  let override = null;
  window.__auditSet = (selector, value) => { const input = document.querySelector(selector); const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); };
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url || String(input), location.href);
    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname.endsWith('/token')) {
        const encode = value => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
        const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: uid, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.synthetic`;
        return response({ access_token: token, refresh_token: 'synthetic-refresh', expires_in: 3600, token_type: 'bearer', user });
      }
      return response(user);
    }
    if (url.origin !== location.origin || (init?.cache === 'no-store' && init?.headers instanceof Headers)) {
      if (url.pathname === '/users/me') return response({ authUserId: uid, role: 'ADMIN', adminPermission: { canApproveListings: true, canManageAdmins: true, canManageComplaints: true } });
      if (url.pathname === '/listings/pending') return response(page([{ ...listing, status: 'PENDING_APPROVAL' }]));
      if (url.pathname === '/listings' && url.searchParams.has('searchLatitude')) {
        if (window.__perimeterMode === 'rate') return new Response(JSON.stringify({ message: 'Too many requests' }), { status: 429 });
        if (window.__perimeterMode === 'error') return new Response('{}', { status: 503 });
        if (window.__perimeterMode === 'empty') return response(page([]));
        if (window.__perimeterMode === 'slow') { await new Promise(resolve => setTimeout(resolve, 1800)); return response(page([{ ...listing, areaText: 'Obsolete result' }])); }
      }
      if (['/listings', '/listings/mine'].includes(url.pathname)) return response(page([listing]));
      if (url.pathname === `/listings/${lid}`) return response(listing);
      if (url.pathname === '/listings/admin/lookup/sl-000001') return response(listing);
      if (url.pathname.startsWith('/listings/')) return new Response(JSON.stringify({ message: 'Property unavailable' }), { status: 404 });
      if (['/requests', '/requests/mine'].includes(url.pathname)) { if (init?.method === 'POST') window.__submittedBrief = JSON.parse(init.body); return response(init?.method === 'POST' ? request : page([request])); }
      if (url.pathname === '/complaints') return response(page([{ id: rid, targetType: 'LISTING', targetId: lid, reason: 'Please review the availability of this property.', status: 'OPEN', adminNotes: null, createdAt: now }]));
      if (url.pathname.includes('/candidates/')) return response({ ...assessment, areaMatched: false, requiresReview: true, criteria: assessment.criteria.map(c => c.key === 'area' ? { ...c, status: 'different', detail: 'Outside selected area.' } : c), listing: { ...listing, latitude: 7.1 }, withinArea: false, distanceKm: 19.2, meetsNonLocationRequirements: true, locationWarning: 'This property is outside the selected search perimeter.' });
      if (url.pathname.endsWith('/matches')) return response(page(override ? [override] : []));
      if (url.pathname.endsWith('/suggestions')) {
        if (init?.method === 'POST') { const payload = JSON.parse(init.body); window.__overridePayload = payload; override = { id: 'match', listing, status: 'SUGGESTED', recommendationReason: payload.recommendationReason, recommendedByAdminId: uid, recommendationReviewedAt: now, locationOverrideReason: payload.recommendationReason, locationOverrideAdminId: uid, locationOverrideAt: now }; return response(override); }
        return response(page([{ ...assessment, reference: listing.reference, ownerContact: listing.ownerContact, listingId: lid, matchId: null, status: null, score: 75, reasons: ['Within the selected search perimeter'], whatsappMessage: 'Listing ID: SL-000001\nSynthetic introduction', latitude: listing.latitude, longitude: listing.longitude, areaText: listing.areaText, monthlyRent: listing.monthlyRent, distanceKm: 0.01 }]));
      }
      if (url.pathname === '/matching/dashboard') return response(page([{ ...assessment, reference: listing.reference, ownerContact: listing.ownerContact, id: 'pair', requestId: rid, listingId: lid, requestArea: request.areaText, areaText: listing.areaText, monthlyRent: listing.monthlyRent }]));
      if (url.pathname.startsWith('/matching/')) return response(page([]));
      // Never send an unrecognized API/auth call to an external service.
      return new Response('{}', { status: 503 });
    }
    return originalFetch(input, init);
  };
}

try {
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(${installFixtures.toString()})()` });
  const results = [];
  for (const width of [1440, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 500 });
    await send('Page.navigate', { url: base });
    await pause(1800);
    const home = await evaluate('({ heading: document.querySelector("h1")?.textContent, overflow: document.documentElement.scrollWidth > innerWidth + 2 })');
    results.push({ width, route: '/', ...home });
    const homeShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(`${output}/home-${width}.png`, Buffer.from(homeShot.data, 'base64'));
    await send('Page.navigate', { url: `${base}/login` });
    for (let i = 0; i < 30; i++) { await pause(300); if (await evaluate('!!document.querySelector("#login-password")')) break; }
    const toggle = await evaluate(`(() => {
      const input = document.querySelector('#login-password');
      const button = document.querySelector('.password-toggle');
      input.value = 'Synthetic-password-123'; button.click(); return true;
    })()`);
    await pause(100);
    const revealed = await evaluate('document.querySelector("#login-password").type === "text" && document.querySelector("#login-password").value === "Synthetic-password-123"');
    await evaluate('document.querySelector(".password-toggle").click()');
    await pause(100);
    const hidden = await evaluate('document.querySelector("#login-password").type === "password"');
    results.push({ width, test: 'password-toggle', pass: toggle && revealed && hidden });
    const loginShot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(`${output}/login-${width}.png`, Buffer.from(loginShot.data, 'base64'));
    await evaluate(`(() => { document.querySelector('[name=email]').value = 'ui-review@example.test'; document.querySelector('form').requestSubmit(); })()`);
    for (let i = 0; i < 40; i++) { await pause(300); if (await evaluate('location.pathname === "/admin" && !!document.querySelector(".admin-dashboard")')) break; }
    const routes = ['/listings', '/property/22222222-2222-4222-8222-222222222222', '/renter/new', '/renter/dashboard', '/owner/new', '/owner/listings', '/admin', '/admin/listings', '/admin/requests', '/admin/complaints'];
    for (const route of routes) {
      // Click a hydrated Next Link to retain the in-memory test session.
      await evaluate(`(() => { for (const selector of ['.site-menu-toggle', '.admin-menu-toggle']) { const button = document.querySelector(selector); if (button && getComputedStyle(button).display !== 'none' && button.getAttribute('aria-expanded') === 'false') button.click(); } })()`);
      // Next's router is reached via the existing navigation links where possible.
      const clicked = await evaluate(`(() => { const link = [...document.querySelectorAll('a')].find(a => a.id !== 'audit-link' && a.getAttribute('href') === ${JSON.stringify(route)}); if (link) { link.click(); return true; } return false; })()`);
      if (!clicked) { results.push({ width, route, skipped: 'No rendered navigation link' }); continue; }
      for (let attempt = 0; attempt < 60; attempt++) {
        await pause(250);
        if (await evaluate(`location.pathname === ${JSON.stringify(route)} && !!document.querySelector('h1')`)) break;
      }
      await pause(400);
      if (route === '/renter/new') {
        const click = async text => { await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(text)})); if (!button) throw new Error('Button unavailable'); button.click(); })()`); await pause(150); };
        await evaluate(`window.__auditSet('#areaText', 'Colombo 5')`);
        await click('Start from Colombo'); await pause(1800);
        await evaluate(`window.__auditSet('input[type=range]', '6')`); await pause(1000);
        const mapReady = await evaluate(`!!document.querySelector('.leaflet-container') && document.querySelectorAll('.leaflet-interactive').length >= 2 && document.querySelector('input[type=range]').value === '6'`);
        results.push({ width, test: 'map-circle-markers-radius', pass: mapReady });
        const mapShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        await writeFile(`${output}/perimeter-selection-${width}.png`, Buffer.from(mapShot.data, 'base64'));
        await evaluate(`document.querySelector('.leaflet-container').scrollIntoView({ block: 'center' })`); await pause(300);
        const centreBefore = await evaluate(`document.querySelector('input[type=number]').value`);
        const mapRect = await evaluate(`(() => { const r = document.querySelector('.leaflet-container').getBoundingClientRect(); return { x: r.left + r.width / 2 + 45, y: r.top + r.height / 2 + 30 }; })()`);
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...mapRect, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...mapRect, button: 'left', clickCount: 1 }); await pause(350);
        results.push({ width, test: 'map-click-selects-centre', pass: await evaluate(`document.querySelector('input[type=number]').value !== ${JSON.stringify(centreBefore)}`) });
        const beforeDrag = await evaluate(`document.querySelector('input[type=number]').value`);
        const markerRect = await evaluate(`(() => { const r = document.querySelector('.leaflet-marker-icon').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...markerRect });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...markerRect, button: 'left', clickCount: 1 });
        for (let move = 1; move <= 5; move++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: markerRect.x + move * 6, y: markerRect.y + move * 4, button: 'left', buttons: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: markerRect.x + 30, y: markerRect.y + 20, button: 'left', clickCount: 1 }); await pause(300);
        results.push({ width, test: 'marker-drag-updates-centre', pass: await evaluate(`document.querySelector('input[type=number]').value !== ${JSON.stringify(beforeDrag)}`) });
        await evaluate(`window.__perimeterMode = 'slow'; window.__auditSet('input[type=range]', '6.5')`); await pause(750);
        await evaluate(`window.__perimeterMode = undefined; window.__auditSet('input[type=range]', '7')`); await pause(2200);
        results.push({ width, test: 'stale-results-ignored', pass: await evaluate(`!document.body.textContent.includes('Obsolete result') && document.querySelector('.perimeter-results').textContent.includes('Rajagiriya')`) });
        await evaluate(`window.__auditSet('input[type=range]', '6'); const tile = document.querySelector('.leaflet-tile'); if (tile) tile.dispatchEvent(new Event('error'));`); await pause(200);
        results.push({ width, test: 'tile-failure-fallback', pass: await evaluate(`document.body.textContent.includes('Map tiles could not load') && document.querySelector('#areaText').value === 'Colombo 5'`) });
        await click('Retry map');
        await click('Continue'); await evaluate(`window.__auditSet('#budgetMax', '100000')`); await click('Continue'); await click('Continue');
        results.push({ width, test: 'review-perimeter', pass: await evaluate(`document.body.textContent.includes('6 km radius')`) });
        await click('Back'); await click('Back'); await click('Back');
        results.push({ width, test: 'back-preserves-area', pass: await evaluate(`document.querySelector('#areaText').value === 'Colombo 5' && document.querySelector('input[type=range]').value === '6'`) });
        await click('Clear search area');
        results.push({ width, test: 'clear-preserves-text', pass: await evaluate(`!document.querySelector('input[type=range]') && document.querySelector('#areaText').value === 'Colombo 5'`) });
        await evaluate(`window.__perimeterMode = 'rate'`); await click('Start from Colombo'); await pause(900);
        results.push({ width, test: 'rate-limit-feedback', pass: await evaluate(`document.body.textContent.includes('wait a minute')`) });
        await evaluate(`window.__perimeterMode = 'empty'`); await click('Retry results'); await pause(900);
        results.push({ width, test: 'empty-feedback', pass: await evaluate(`document.body.textContent.includes('No homes with a mapped location')`) });
        await evaluate(`window.__perimeterMode = undefined`);
        await click('Continue'); await click('Continue'); await click('Continue');
        await evaluate(`window.__auditSet('#renterContact', '712345678')`); await click('Send private request'); await pause(400);
        results.push({ width, test: 'submit-perimeter', pass: await evaluate(`window.__submittedBrief?.searchRadiusKm === 3 && window.__submittedBrief?.areaText === 'Colombo 5' && window.__submittedBrief?.budgetMax === 100000`) });
      }
      if (route === '/admin/listings') {
        await evaluate(`window.__auditSet('input[name="listingReference"]', 'sl-000001')`);
        await pause(100);
        await evaluate(`document.querySelector('input[name="listingReference"]').closest('form').requestSubmit()`);
        await pause(500);
        results.push({ width, test: 'admin-reference-search', pass: await evaluate(`document.body.textContent.includes('SL-000001: Rajagiriya') && document.body.textContent.includes('Owner contact (admin only): +94710000000')`) });
      }
      if (route === '/admin/requests') {
        await evaluate(`document.querySelector('.match-action').click()`); await pause(500);
        await evaluate(`document.querySelectorAll('summary').forEach(s => s.click())`); await pause(300);
        results.push({ width, test: 'admin-exact-distance', pass: await evaluate(`document.body.textContent.includes('Exact distance: 0.01 km')`) });
        results.push({ width, test: 'match-private-contact-and-reference', pass: await evaluate(`document.querySelector('.match-suggestion').textContent.includes('Listing ID: SL-000001') && document.querySelector('.match-suggestion').textContent.includes('Owner contact (admin only): +94710000000')`) });
        await evaluate(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copiedMatch = text; } } }); [...document.querySelectorAll('button')].find(b => b.textContent.includes('Copy message')).click()`);
        await pause(100);
        results.push({ width, test: 'copied-reference-without-owner-contact', pass: await evaluate(`window.__copiedMatch.includes('Listing ID: SL-000001') && !window.__copiedMatch.includes('+94710000000')`) });

        await evaluate(`window.__auditSet('input[id$="-listing"]', 'sl-000001');`);
        await evaluate(`([...document.querySelectorAll('button')].find(b => b.textContent.includes('Look up active listing'))).click()`); await pause(400);
        results.push({ width, test: 'override-location-warning', pass: await evaluate(`document.body.textContent.includes('outside the selected search perimeter')`) });
        await evaluate(`window.__auditSet('textarea', 'Renter agreed to this area during our call')`);
        await evaluate(`([...document.querySelectorAll('button')].find(b => b.textContent.includes('Record recommendation'))).click()`); await pause(500);
        results.push({ width, test: 'override-recorded', pass: await evaluate(`window.__overridePayload?.recommendationReason === 'Renter agreed to this area during our call' && document.body.textContent.includes('Reviewed recommendation')`) });
      }
      const result = await evaluate(`({ pathname: location.pathname, heading: document.querySelector('h1')?.textContent, overflow: document.documentElement.scrollWidth > innerWidth + 2 })`);
      results.push({ width, route, ...result });
      const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      await writeFile(`${output}/${route.replaceAll('/', '-') || 'home'}-${width}.png`, Buffer.from(screenshot.data, 'base64'));
    }
    await send('Page.navigate', { url: `${base}/missing-audit-page` });
    await pause(1200);
    results.push({ width, route: '/missing-audit-page', ...(await evaluate('({ heading: document.querySelector("h1")?.textContent, overflow: document.documentElement.scrollWidth > innerWidth + 2 })')) });
  }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  if (results.some(result => result.overflow || result.skipped || result.pass === false || (result.pathname && result.pathname !== result.route))) process.exitCode = 1;
} finally { socket.close(); }
