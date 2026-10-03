import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createCollection, generatePostman } from '../scripts/generate-postman.mjs';

test('every request isolates explicit account cookies from the Postman cookie jar', () => {
  const collection = createCollection();
  assert.equal(collection.protocolProfileBehavior.disableCookies, true);
  for (const item of collection.item) {
    assert.equal(item.protocolProfileBehavior.disableCookies, true, item.name);
    const cookies = item.request.header.filter(header => header.key === 'Cookie');
    assert.ok(cookies.every(header => /^\{\{\w+Token\}\}$/.test(header.value)), item.name);
    new Function(item.event[0].script.exec.join('\n'));
  }
  assert.equal(collection.item.find(item => item.name === 'Protected endpoint without cookie').request.header.some(header => header.key === 'Cookie'), false);
});

test('regeneration preserves configured connection and administrator, but drops old sessions', t => {
  const directory = mkdtempSync(join(tmpdir(), 'netscope-postman-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = join(directory, 'collection.json');
  const config = { baseUrl: 'https://test.example', adminEmail: 'custom@example.test', adminPassword: 'CustomPassword123!' };
  writeFileSync(output, JSON.stringify({ variable: [
    ...Object.entries(config).map(([key, value]) => ({ key, value })),
    { key: 'ownerToken', value: 'stale-cookie' }
  ] }));
  generatePostman(output);
  const collection = JSON.parse(readFileSync(output, 'utf8'));
  assert.deepEqual(Object.fromEntries(collection.variable.map(({ key, value }) => [key, value])), config);
});
