import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { scenarios } from './scenarios.mjs';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:5220';
const run = crypto.randomUUID();
const vars = { ownerEmail: `demo-${run}@example.test`, otherEmail: `other-${run}@example.test`, password: `Demo!${run}`, adminEmail: process.env.ADMIN_EMAIL ?? 'admin@netscope.local', adminPassword: process.env.ADMIN_PASSWORD ?? 'NetScopeDemo!2026' };
const resolve = value => {
  if (typeof value === 'string') return value.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    assert.ok(vars[name] !== undefined, `Missing variable ${name}`);
    return vars[name];
  });
  if (Array.isArray(value)) return value.map(resolve);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item)]));
  return value;
};
const at = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const started = performance.now();
let passed = 0;
try {
  for (const scenario of scenarios) {
    const test = resolve(scenario);
    const headers = { 'Content-Type': 'application/json' };
    if (test.token) headers.Authorization = `Bearer ${vars[test.token]}`;
    const response = await fetch(baseUrl + test.path, { method: test.method, headers, body: test.raw ?? (test.body ? JSON.stringify(test.body) : undefined), signal: AbortSignal.timeout(10000) });
    const text = await response.text();
    assert.equal(response.status, test.status, `${test.name}: ${text}`);
    let body;
    if (test.status === 204) assert.equal(text, '', test.name);
    else {
      assert.match(response.headers.get('content-type') ?? '', /application\/(problem\+)?json/, test.name);
      body = JSON.parse(text);
      if (test.status >= 400) assert.equal(body.status, test.status, test.name);
    }
    if (test.status === 201) assert.ok(response.headers.get('location'), `${test.name}: Location header`);
    for (const [key, path] of Object.entries(test.save ?? {})) { assert.ok(at(body, path), test.name); vars[key] = at(body, path); }
    for (const [path, expected] of Object.entries(test.equals ?? {})) assert.deepEqual(at(body, path), expected, `${test.name}: ${path}`);
    for (const path of test.absent ?? []) assert.equal(at(body, path), undefined, `${test.name}: ${path}`);
    if (test.jwtRole) {
      const claims = JSON.parse(Buffer.from(body.accessToken.split('.')[1], 'base64url'));
      assert.equal(claims.role, test.jwtRole);
      assert.equal(claims.sub, body.user.id);
      assert.ok(claims.jti && claims.exp > claims.iat || claims.jti && claims.exp > claims.nbf);
    }
    passed++;
    console.log(`PASS ${String(passed).padStart(2)} | ${test.status} | ${test.name}`);
  }
  const specResponse = await fetch(baseUrl + '/openapi/v1.json');
  assert.equal(specResponse.status, 200);
  const spec = await specResponse.json();
  const operations = Object.entries(spec.paths).flatMap(([path, methods]) => Object.entries(methods).filter(([method]) => ['get', 'post', 'put', 'delete'].includes(method)).map(([method, operation]) => ({ path, method, operation })));
  assert.equal(operations.filter(x => x.path.startsWith('/api/locations')).length, 15);
  for (const { path, method, operation } of operations) {
    assert.ok(operation.summary, `OpenAPI summary: ${method} ${path}`);
    if (path.startsWith('/api/') && !['/api/auth/login', '/api/auth/register'].includes(path)) assert.ok(operation.security?.length, `OpenAPI security: ${path}`);
  }
  console.log(`PASS OpenAPI: ${operations.length} operations, including all 15 CRUD methods`);
  console.log(`\n${passed}/${scenarios.length} HTTP scenarios passed in ${((performance.now() - started) / 1000).toFixed(2)} s.`);
} catch (error) {
  console.error(`FAIL after ${passed} scenarios: ${error.message}`);
  process.exitCode = 1;
} finally {
  // Only delete accounts created by this run; cascades clean up their test objects after failures.
  if (passed !== scenarios.length && vars.adminToken) {
    for (const id of [vars.ownerId, vars.otherId].filter(Boolean)) await fetch(`${baseUrl}/api/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${vars.adminToken}` } }).catch(() => {});
  }
}
