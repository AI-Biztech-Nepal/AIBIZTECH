import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDetails, validatePhoto, type Details } from './org-details.ts';

const ok: Details = {
  name: 'Acme', address: 'Kathmandu', phone: '9841000000', email: 'info@acme.np',
  owner_name: 'Ram', owner_address: 'Lalitpur', owner_phone: '+977 9851000000', owner_email: 'ram@acme.np', pan_no: '123456789',
};

test('complete details pass', () => assert.equal(validateDetails(ok), null));

test('each bad field is rejected', () => {
  assert.match(validateDetails({ ...ok, name: '' })!, /required/);
  assert.match(validateDetails({ ...ok, owner_phone: 'abc' })!, /phone/);
  assert.match(validateDetails({ ...ok, email: 'nope' })!, /email/);
  assert.match(validateDetails({ ...ok, pan_no: '12345' })!, /PAN/);
});

test('photo must be a small image', () => {
  assert.equal(validatePhoto({ type: 'image/png', size: 1000 }), null);
  assert.match(validatePhoto({ type: 'application/pdf', size: 1000 })!, /JPG/);
  assert.match(validatePhoto({ type: 'image/png', size: 5 * 1024 * 1024 })!, /4 MB/);
});
