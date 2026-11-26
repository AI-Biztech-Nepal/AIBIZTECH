import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signInProblem } from './signin.ts';

test('sign-in problems are put in plain words', () => {
  assert.equal(signInProblem({ code: 'invalid_credentials', message: 'Invalid login credentials' }), 'That email and password do not match.');
  assert.match(signInProblem({ code: 'email_not_confirmed', message: 'Email not confirmed' }), /^Confirm your email first/);
  assert.match(signInProblem({ name: 'AuthRetryableFetchError', message: 'fetch failed' }), /not responding/);
  // anything else is passed on unchanged
  assert.equal(signInProblem({ code: 'over_request_rate_limit', message: 'Too many requests' }), 'Too many requests');
});
