import { writeFileSync, mkdirSync } from 'node:fs';
import { scenarios } from './scenarios.mjs';
mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
const collection = {
  info: { name: 'NetScope - 15 CRUD and JWT authorization', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json', description: 'Run the entire collection in order with zero delay. Creates temporary users and removes them at the end. Requires seeded demo administrator.' },
  variable: [ ['baseUrl', 'http://localhost:5220'], ['adminEmail', 'admin@netscope.local'], ['adminPassword', 'NetScopeDemo!2026'] ].map(([key, value]) => ({ key, value })),
  event: [{ listen: 'prerequest', script: { type: 'text/javascript', exec: [
    "if (pm.info.requestName === 'API and PostgreSQL health') {",
    "  const run = pm.variables.replaceIn('{{$guid}}');",
    "  pm.collectionVariables.set('ownerEmail', 'demo-' + run + '@example.test');",
    "  pm.collectionVariables.set('otherEmail', 'other-' + run + '@example.test');",
    "  pm.collectionVariables.set('password', 'Demo!' + run);",
    "}"
  ] } }],
  item: scenarios.map(test => {
    const code = [
      `pm.test('HTTP ${test.status}', () => pm.response.to.have.status(${test.status}));`,
      test.status === 204 ? "pm.test('Empty body', () => pm.expect(pm.response.text()).to.eql(''));" : "pm.test('JSON content type', () => pm.expect(pm.response.headers.get('Content-Type')).to.match(/application\\/(problem\\+)?json/));",
      "const at = (o, p) => p.split('.').reduce((v, k) => v && v[k], o);",
      ...(test.status === 204 ? [] : ["const body = pm.response.json();"]),
      ...(test.status >= 400 ? [`pm.test('Problem status', () => pm.expect(body.status).to.eql(${test.status}));`] : []),
      ...(test.status === 201 ? ["pm.test('Location header', () => pm.expect(pm.response.headers.get('Location')).to.be.ok);"] : []),
      ...Object.entries(test.save ?? {}).map(([key, path]) => `pm.collectionVariables.set(${JSON.stringify(key)}, at(body, ${JSON.stringify(path)}));`),
      ...Object.entries(test.equals ?? {}).map(([path, expected]) => `pm.test(${JSON.stringify(path)}, () => pm.expect(at(body, ${JSON.stringify(path)})).to.eql(JSON.parse(pm.variables.replaceIn(${JSON.stringify(JSON.stringify(expected))}))));`),
      ...(test.absent ?? []).map(path => `pm.test('No secret fields', () => pm.expect(at(body, ${JSON.stringify(path)})).to.be.undefined);`),
      ...(test.jwtRole ? [`pm.test('JWT role', () => pm.expect(JSON.parse(atob(body.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role).to.eql(${JSON.stringify(test.jwtRole)}));`] : []),
    ];
    return { name: test.name, request: { method: test.method, header: [{ key: 'Content-Type', value: 'application/json' }],
      ...(test.token ? { auth: { type: 'bearer', bearer: [{ key: 'token', value: `{{${test.token}}}`, type: 'string' }] } } : { auth: { type: 'noauth' } }),
      url: '{{baseUrl}}' + test.path,
      ...(test.body || test.raw ? { body: { mode: 'raw', raw: test.raw ?? JSON.stringify(test.body, null, 2), options: { raw: { language: 'json' } } } } : {}) },
      event: [{ listen: 'test', script: { type: 'text/javascript', exec: code } }] };
  })
};
// Catch JavaScript syntax errors in the generated test scripts before exporting.
for (const item of collection.item) new Function(item.event[0].script.exec.join('\n'));
writeFileSync(new URL('../docs/NetScope.postman_collection.json', import.meta.url), JSON.stringify(collection, null, 2) + '\n');
console.log(`Generated ${collection.item.length} Postman requests.`);
