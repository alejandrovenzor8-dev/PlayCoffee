const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'apps/frontend/node_modules/typescript'));
const filename = path.join(root, 'apps/frontend/src/lib/connection-origin.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = new Module(filename, module);
loaded._compile(compiled, filename);
const { resolveApiOrigin, resolveSocketOrigin, isLocalOrigin } = loaded.exports;

test('local HTTPS uses the phone address even with stale HTTP production URLs', () => {
  const phone = 'https://192.168.1.80:3443';
  assert.equal(resolveApiOrigin('http://192.168.100.51:3001', phone), phone);
  assert.equal(resolveSocketOrigin('http://192.168.100.51:3001', phone), phone);
});
test('local HTTPS preserves custom ports and does not require configured public URLs', () => {
  const phone = 'https://192.168.1.80:3143';
  assert.equal(resolveApiOrigin(undefined, phone), phone);
  assert.equal(resolveSocketOrigin(undefined, phone), phone);
});
test('local HTTP proxies the API while Socket.IO uses the same host at the backend port', () => {
  assert.equal(resolveApiOrigin('http://192.168.100.51:3001', 'http://192.168.1.80:3000'), 'http://192.168.1.80:3000');
  assert.equal(resolveSocketOrigin('ws://192.168.100.51:3001', 'http://192.168.1.80:3000'), 'http://192.168.1.80:3001');
  assert.equal(resolveSocketOrigin('http://192.168.1.80:3040', 'http://192.168.1.80:3000'), 'http://192.168.1.80:3040');
});
test('cloud deployments retain intentionally separate API and realtime origins', () => {
  assert.equal(resolveApiOrigin('https://api.example.com/api/v1/', 'https://app.example.com'), 'https://api.example.com');
  assert.equal(resolveSocketOrigin('https://api.example.com/', 'https://app.example.com'), 'https://api.example.com');
});
test('private networks are distinguished from public hostnames and addresses', () => {
  for (const host of ['localhost', 'playcoffee.local', '192.168.1.80', '10.1.1.5', '172.16.1.5', '172.31.1.5', '[::1]']) assert.equal(isLocalOrigin(`https://${host}`), true);
  for (const host of ['app.example.com', 'fcloud.example.com', '8.8.8.8', '172.32.1.5', '172.15.1.5', '[2001:4860:4860::8888]']) assert.equal(isLocalOrigin(`https://${host}`), false);
});
