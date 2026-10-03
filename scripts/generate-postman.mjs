import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scenarios } from './scenarios.mjs';

const defaults = { baseUrl: 'http://localhost:5220', adminEmail: 'admin@netscope.local', adminPassword: 'NetScopeDemo!2026' };
const runtimeKeys = [...new Set([
  'ownerEmail', 'otherEmail', 'password',
  ...scenarios.flatMap(test => [...Object.keys(test.save ?? {}), test.saveCookie, test.previousCookie].filter(Boolean))
])];

export function createCollection(config = {}) {
  const collection = {
    info: { name: 'NetScope - CRUD and JWT cookies', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json', description: 'Run the entire collection in order with zero delay. Uses explicit HttpOnly JWT and refresh cookies for each test account, creates temporary users and removes them at the end. Requires a valid administrator configured in adminEmail and adminPassword; demo data is not required.' },
    protocolProfileBehavior: { disableCookies: true },
    variable: Object.entries(defaults).map(([key, value]) => ({ key, value: config[key] ?? value })),
    event: [{ listen: 'prerequest', script: { type: 'text/javascript', exec: [
      `const runtimeKeys = ${JSON.stringify(runtimeKeys)};`,
      "if (pm.info.requestName === 'API and PostgreSQL health') {",
      "  runtimeKeys.forEach(key => pm.collectionVariables.set(key, ''));",
      "  const run = pm.variables.replaceIn('{{$guid}}');",
      "  pm.collectionVariables.set('ownerEmail', 'demo-' + run + '@example.test');",
      "  pm.collectionVariables.set('otherEmail', 'other-' + run + '@example.test');",
      "  pm.collectionVariables.set('password', 'Demo!' + run);",
      "}",
      "runtimeKeys.forEach(key => pm.variables.set(key, pm.collectionVariables.get(key)));"
    ] } }],
    item: scenarios.map(test => {
      const code = [
        `pm.test('HTTP ${test.status}', () => pm.response.to.have.status(${test.status}));`,
        test.status === 204 ? "pm.test('Empty body', () => pm.expect(pm.response.text()).to.eql(''));" : "pm.test('JSON content type', () => pm.expect(pm.response.headers.get('Content-Type')).to.match(/application\\/(problem\\+)?json/));",
        "const at = (o, p) => p.split('.').reduce((v, k) => v == null ? undefined : v[k], o);",
        "const save = (key, value) => { pm.collectionVariables.set(key, value); pm.variables.set(key, value); };",
        ...(test.status === 204 ? [] : ["const body = pm.response.json();"]),
        ...(test.status >= 400 ? [`pm.test('Problem status', () => pm.expect(body.status).to.eql(${test.status}));`] : []),
        ...(test.status === 201 ? ["pm.test('Location header', () => pm.expect(pm.response.headers.get('Location')).to.be.ok);"] : []),
        ...Object.entries(test.save ?? {}).map(([key, path]) => `save(${JSON.stringify(key)}, at(body, ${JSON.stringify(path)}));`),
        ...(test.previousCookie ? [`save(${JSON.stringify(test.previousCookie)}, pm.collectionVariables.get(${JSON.stringify(test.saveCookie)}));`] : []),
        ...(test.saveCookie ? [
          "const cookiePairs = pm.response.headers.all().filter(h => h.key.toLowerCase() === 'set-cookie').flatMap(h => Array.from(h.value.matchAll(/netscope_(?:access|refresh)=[^;,\\s]+/g), m => m[0]));",
          "pm.test('HttpOnly JWT and refresh cookies', () => { pm.expect(cookiePairs.length).to.eql(2); pm.response.headers.all().filter(h => h.key.toLowerCase() === 'set-cookie').forEach(h => { pm.expect(h.value).to.match(/HttpOnly/i); pm.expect(h.value).to.match(/SameSite=Strict/i); }); });",
          `save(${JSON.stringify(test.saveCookie)}, cookiePairs.join('; '));`
        ] : []),
        ...Object.entries(test.equals ?? {}).map(([path, expected]) => `pm.test(${JSON.stringify(path)}, () => pm.expect(at(body, ${JSON.stringify(path)})).to.eql(JSON.parse(pm.variables.replaceIn(${JSON.stringify(JSON.stringify(expected))}))));`),
        ...(test.absent ?? []).map(path => `pm.test('No secret fields', () => pm.expect(at(body, ${JSON.stringify(path)})).to.be.undefined);`),
        ...(test.has ?? []).map(path => `pm.test(${JSON.stringify(path)}, () => pm.expect(at(body, ${JSON.stringify(path)})).not.to.be.undefined);`),
        ...(test.jwtRole ? [`pm.test('JWT role', () => { const cookie = pm.collectionVariables.get(${JSON.stringify(test.saveCookie)}); const jwt = /netscope_access=([^;]+)/.exec(cookie)[1]; pm.expect(JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role).to.eql(${JSON.stringify(test.jwtRole)}); });`] : []),
      ];
      return { name: test.name, protocolProfileBehavior: { disableCookies: true }, request: { method: test.method, header: [{ key: 'Content-Type', value: 'application/json' }, ...(test.token ? [{ key: 'Cookie', value: `{{${test.token}}}` }] : []), ...(test.origin ? [{ key: 'Origin', value: test.origin }] : [])],
        auth: { type: 'noauth' },
        url: '{{baseUrl}}' + test.path,
        ...(test.body || test.raw ? { body: { mode: 'raw', raw: test.raw ?? JSON.stringify(test.body, null, 2), options: { raw: { language: 'json' } } } } : {}) },
        event: [{ listen: 'test', script: { type: 'text/javascript', exec: code } }] };
    })
  };
  // Catch JavaScript syntax errors in the generated test scripts before exporting.
  for (const item of collection.item) new Function(item.event[0].script.exec.join('\n'));
  for (const event of collection.event) new Function(event.script.exec.join('\n'));
  return collection;
}

export function generatePostman(output = new URL('../docs/NetScope.postman_collection.json', import.meta.url)) {
  const existing = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : {};
  // Keep only user configuration, never session variables from a previous run.
  const config = Object.fromEntries((existing.variable ?? []).filter(({ key }) => Object.hasOwn(defaults, key)).map(({ key, value }) => [key, value]));
  const collection = createCollection(config);
  mkdirSync(dirname(output instanceof URL ? fileURLToPath(output) : output), { recursive: true });
  writeFileSync(output, JSON.stringify(collection, null, 2) + '\n');
  return collection;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const collection = generatePostman();
  console.log(`Generated ${collection.item.length} Postman requests.`);
}
