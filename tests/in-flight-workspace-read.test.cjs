const { test } = require('node:test'), assert = require('node:assert/strict');
const { load } = require('./helpers/voting-harness.cjs');
const { inFlightWorkspaceRead: read } = load('lib/in-flight-workspace-read.ts');

test('identical simultaneous reads share work only inside the exact resource authority owner', async () => {
  const owner = {}, otherAccount = {}, otherEpoch = {}, otherRevision = {};
  let calls = 0; const releases = [];
  const loadRead = () => { calls++; return new Promise(resolve => releases.push(resolve)); };
  const a = read(owner, 'page', ['club', { query: 'A', sort: 'name' }], loadRead);
  const b = read(owner, 'page', ['club', { query: 'A', sort: 'name' }], loadRead);
  assert.equal(a, b);
  const others = [
    read(otherAccount, 'page', ['club', { query: 'A', sort: 'name' }], loadRead),
    read(otherEpoch, 'page', ['club', { query: 'A', sort: 'name' }], loadRead),
    read(otherRevision, 'page', ['club', { query: 'A', sort: 'name' }], loadRead),
    read(owner, 'selection', ['club', { query: 'A', sort: 'name' }], loadRead),
    read(owner, 'page', ['other club', { query: 'A', sort: 'name' }], loadRead),
    ...[{ query: 'B' }, { query: 'A', sort: 'score' }, { query: 'A', cursor: 'next' }, { query: 'A', selected: ['id'] }]
      .map(query => read(owner, 'page', ['club', query], loadRead)),
  ];
  assert.equal(calls, 10);
  releases.forEach(resolve => resolve('fresh'));
  await Promise.all([a, b, ...others]);
  await read(owner, 'page', ['club', { query: 'A', sort: 'name' }], async () => { calls++; return 'new guard'; });
  assert.equal(calls, 11, 'a completed success never authorizes a subsequent request');
});

test('denials and synchronous failures never remain reusable', async () => {
  const owner = {}; let calls = 0;
  await assert.rejects(read(owner, 'detail', ['id'], async () => { calls++; throw Error('revoked'); }), /revoked/);
  await assert.rejects(read(owner, 'detail', ['id'], () => { calls++; throw Error('dispatch failed'); }), /dispatch failed/);
  assert.equal(await read(owner, 'detail', ['id'], async () => { calls++; return 'fresh'; }), 'fresh');
  assert.equal(calls, 3);
});
