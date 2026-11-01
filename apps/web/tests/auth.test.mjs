import { en } from '../lib/i18n/messages.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { loginDestination } from '../lib/login-destination.ts';

test('password control toggles visibility without submitting or replacing the input', () => {
  let visible = false;
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../components/ui/password-field.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, require: path => {
    if (path === 'react') return { useState: () => [visible, update => { visible = update(visible); }] };
    if (path === 'react/jsx-runtime') return jsxRuntime;
    throw new Error(`Unexpected import: ${path}`);
  } });
  const render = () => exports.PasswordField({ id: 'password', name: 'password', autoComplete: 'current-password', required: true });
  const controls = () => render().props.children[1].props.children;
  let [input, toggle] = controls();
  assert.equal(input.props.type, 'password');
  assert.equal(input.props.autoComplete, 'current-password');
  assert.equal(toggle.props.type, 'button');
  assert.equal(toggle.props['aria-label'], 'Show password');
  assert.equal(toggle.props['aria-controls'], input.props.id);
  toggle.props.onClick();
  [input, toggle] = controls();
  assert.equal(input.props.type, 'text');
  assert.equal(input.props.name, 'password');
  assert.equal(toggle.props['aria-pressed'], true);
  assert.equal(toggle.props['aria-label'], 'Hide password');
  toggle.props.onClick();
  assert.equal(controls()[0].props.type, 'password');
});

function renderGuard(file, state, pathname, redirects = []) {
  function loadComponent(name) {
    const exports = {};
    const source = ts.transpileModule(readFileSync(new URL(`../${name}.tsx`, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(source, { exports, require: (path) => {
      if (path === 'react') return { ...React, useEffect: (effect) => effect() };
      if (path === 'react/jsx-runtime') return jsxRuntime;
      if (path === 'next/link') return { default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (path === 'next/navigation') return { usePathname: () => pathname, useRouter: () => ({ replace: (href) => redirects.push(href) }) };
      if (path.endsWith('auth-provider')) return { useAuth: () => state };
      if (path.endsWith('require-session')) return loadComponent('components/require-session');
      if (path.endsWith('admin-sidebar')) return loadComponent('components/admin-sidebar');
      if (path.endsWith('i18n-provider')) return { useT: () => (key) => en[key] };
      if (path.endsWith('language-switcher')) return { LanguageSwitcher: () => React.createElement('select', null) };
      if (path.endsWith('notifications-link')) return { NotificationsLink: () => React.createElement('a', { href: '/notifications' }, 'Notifications') };
      if (path.endsWith('theme-toggle')) return { ThemeToggle: () => React.createElement('button', { className: 'theme-toggle' }) };
      if (path.endsWith('access-redirect')) return { AccessRedirect: ({ href }) => React.createElement('a', { href }, 'Redirect') };
      throw new Error(`Unexpected import: ${path}`);
    }, document: { addEventListener() {}, removeEventListener() {} } });
    return exports;
  }
  const component = loadComponent(file);
  return renderToStaticMarkup(React.createElement(component.default ?? component.RequireSession ?? component.SiteHeader, null, 'PRIVATE CONTENT'));
}

const verified = {
  user: { id: 'user-a' }, loading: false, error: null, permissionsLoading: false,
  profileError: null, isAdmin: false,
  permissions: { canApproveListings: false, canManageAdmins: false, canManageComplaints: false },
};

test('renter pages retain renter navigation even when the account has admin permissions', () => {
  const state = { ...verified, role: 'RENTER', isAdmin: true };
  for (const path of ['/renter/dashboard', '/renter/new']) {
    const html = renderGuard('components/site-header', state, path);
    assert.doesNotMatch(html, /admin-sidebar|admin-topbar/);
    assert.match(html, /My requests/);
  }
  assert.match(renderGuard('components/site-header', state, '/admin'), /admin-sidebar/);
});

test('the landing and sign-in pages have no site navigation, only their own slim top bar', () => {
  for (const path of ['/', '/login', '/reset-password'])
    assert.equal(renderGuard('components/site-header', verified, path), '');
});

test('login defaults follow the verified account role, including renters with admin permissions', () => {
  const none = verified.permissions;
  const admin = { ...none, canApproveListings: true };
  assert.equal(loginDestination(null, 'RENTER', none), '/renter/dashboard');
  assert.equal(loginDestination(null, 'RENTER', admin), '/renter/dashboard');
  assert.equal(loginDestination(null, 'OWNER', admin), '/owner/listings');
  assert.equal(loginDestination(null, 'ADMIN', admin), '/admin');
  assert.equal(loginDestination(null, 'ADMIN', none), '/listings');
});

test('login preserves renter destinations instead of overriding them with the admin dashboard', () => {
  for (const role of ['RENTER', 'OWNER']) {
    for (const path of ['/renter/new', '/renter/dashboard', '/owner/new', '/owner/listings']) {
      assert.equal(loginDestination(path, role, { ...verified.permissions, canManageAdmins: true }), path);
    }
  }
});

test('administrators always land on the dashboard after signing in', () => {
  const admin = { ...verified.permissions, canApproveListings: true };
  for (const next of [null, '/listings', '/owner/new', '/renter/dashboard', '/admin/listings', '//evil.example'])
    assert.equal(loginDestination(next, 'ADMIN', admin), '/admin');
});

test('login rejects unauthorized admin destinations and external return URLs', () => {
  for (const path of ['/admin', '/admin/requests', '/admin/complaints', '//evil.example', 'https://evil.example', '/admin/unknown']) {
    assert.equal(loginDestination(path, 'RENTER', verified.permissions), '/renter/dashboard');
  }
  const limited = { ...verified.permissions, canManageComplaints: true };
  assert.equal(loginDestination('/admin/complaints', 'OWNER', limited), '/admin/complaints');
  assert.equal(loginDestination('/admin/requests', 'OWNER', limited), '/owner/listings');
});

test('Supabase disables saved browser sessions and reuses the active in-memory client', () => {
  const exports = {};
  let calls = 0;
  const fakeClient = {};
  const source = ts.transpileModule(readFileSync(new URL('../lib/supabase.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key' } },
    require: (path) => {
      assert.equal(path, '@supabase/supabase-js');
      return { createClient: (_url, _key, options) => {
        calls++;
        assert.equal(options.auth.persistSession, false);
        assert.equal(options.auth.autoRefreshToken, true);
        return fakeClient;
      } };
    },
  });
  assert.equal(exports.getSupabase(), fakeClient);
  assert.equal(exports.getSupabase(), fakeClient);
  assert.equal(calls, 1);
});

test('private layouts block signed-out direct URLs and preserve the login destination', () => {
  for (const area of ['renter', 'owner', 'admin']) {
    const html = renderGuard(`app/${area}/layout`, { ...verified, user: null }, `/${area}/new`);
    assert.doesNotMatch(html, /PRIVATE CONTENT/);
    assert.match(html, new RegExp(`/login\\?next=%2F${area}%2Fnew`));
  }
});

test('private content stays hidden during session/profile loading and verification failures', () => {
  for (const override of [{ loading: true }, { permissionsLoading: true }, { profileError: 'Verification failed' }, { error: 'Expired' }]) {
    const html = renderGuard('components/require-session', { ...verified, ...override }, '/renter/dashboard');
    assert.doesNotMatch(html, /PRIVATE CONTENT/);
  }
  assert.match(renderGuard('app/renter/layout', verified, '/renter/dashboard'), /PRIVATE CONTENT/);
});

test('admin URLs enforce page permissions and fall back without rendering private content', () => {
  assert.match(renderGuard('app/admin/layout', verified, '/admin'), /href="\/login\?next=%2Fadmin"/);
  const admin = { ...verified, isAdmin: true, permissions: { ...verified.permissions, canManageComplaints: true } };
  for (const path of ['/admin/listings', '/admin/requests', '/admin/unknown']) {
    const html = renderGuard('app/admin/layout', admin, path);
    assert.doesNotMatch(html, /PRIVATE CONTENT/);
    assert.ok(html.includes(`href="/login?next=${encodeURIComponent(path)}"`));
  }
  assert.match(renderGuard('app/admin/layout', admin, '/admin/complaints'), /PRIVATE CONTENT/);
  assert.match(renderGuard('app/admin/layout', admin, '/admin'), /PRIVATE CONTENT/);
});

// Run the real helper/client with a fake SDK session and network boundary.
function load(getSession, fetchImpl = async () => { throw new Error('Unexpected network call'); }) {
  const modules = new Map();
  function module(name) {
    if (modules.has(name)) return modules.get(name);
    const exports = {};
    modules.set(name, exports);
    const source = ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(source, {
      exports, Headers, FormData, fetch: fetchImpl,
      process: { env: { NEXT_PUBLIC_API_URL: 'http://test-api.local' } },
      require: (path) => {
        if (path === './supabase') return { getSupabase: () => ({ auth: { getSession } }) };
        if (path === './auth') return module('auth');
        throw new Error(`Unexpected import: ${path}`);
      },
    });
    return exports;
  }
  return { ...module('auth'), ...module('api-client') };
}

test('returns the current Supabase access token', async () => {
  const { getAccessToken } = load(async () => ({ data: { session: { access_token: 'test-token' } }, error: null }));
  assert.equal(await getAccessToken(), 'test-token');
});
test('returns null without a signed-in session', async () => {
  const { getAccessToken } = load(async () => ({ data: { session: null }, error: null }));
  assert.equal(await getAccessToken(), null);
});
test('surfaces session retrieval errors', async () => {
  const { getAccessToken } = load(async () => ({ data: { session: null }, error: new Error('Session unavailable') }));
  await assert.rejects(getAccessToken(), /Session unavailable/);
});
test('authenticated API calls send the current token with JSON requests', async () => {
  const { apiRequest } = load(async () => ({ data: { session: { access_token: 'fresh-token' } }, error: null }), async (url, options) => {
    assert.equal(url, 'http://test-api.local/requests');
    assert.equal(options.headers.get('Authorization'), 'Bearer fresh-token');
    assert.equal(options.headers.get('Content-Type'), 'application/json');
    return new Response(JSON.stringify({ id: 'request-id' }), { status: 201 });
  });
  assert.equal((await apiRequest('/requests', { method: 'POST', authenticated: true, body: '{}' })).id, 'request-id');
});
test('signed-out and failed sessions cannot send authenticated requests', async () => {
  for (const error of [null, new Error('Session unavailable')]) {
    let calls = 0;
    const { apiRequest } = load(async () => ({ data: { session: null }, error }), async () => { calls++; return new Response('{}'); });
    await assert.rejects(apiRequest('/requests/mine', { authenticated: true }));
    assert.equal(calls, 0);
  }
});
test('photo uploads keep browser-generated multipart headers and authentication', async () => {
  const body = new FormData();
  body.append('photos', new Blob(['photo'], { type: 'image/jpeg' }), 'photo.jpg');
  const { apiRequest } = load(async () => ({ data: { session: { access_token: 'test-token' } }, error: null }), async (_url, options) => {
    assert.equal(options.headers.get('Authorization'), 'Bearer test-token');
    assert.equal(options.headers.has('Content-Type'), false);
    assert.equal(options.body, body);
    return new Response('{}');
  });
  await apiRequest('/uploads/property-images', { method: 'POST', authenticated: true, body });
});

test('signing in to book returns to the item page, but only for a real item address', () => {
  const none = verified.permissions;
  const id = '3f2b8c1e-9d4a-4b6e-8f10-2a7c5d9e0b14';
  assert.equal(loginDestination(`/item/${id}`, 'RENTER', none), `/item/${id}`);
  assert.equal(loginDestination('/bookings', 'RENTER', none), '/bookings');
  for (const next of ['/item/not-an-id', `/item/${id}/../../admin`, `/item/${id}?x=1`, `//item/${id}`])
    assert.equal(loginDestination(next, 'RENTER', none), '/renter/dashboard');
});
