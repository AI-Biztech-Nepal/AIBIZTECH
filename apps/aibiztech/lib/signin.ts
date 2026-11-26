export type SignInState = { error?: string };

// What to tell the person when the sign-in service says no
export function signInProblem(error: { code?: string; name?: string; message: string }): string {
  if (error.code === 'invalid_credentials') return 'That email and password do not match.';
  if (error.code === 'email_not_confirmed') return 'Confirm your email first: open the link we sent to your inbox.';
  // The service could not be reached at all
  if (error.name === 'AuthRetryableFetchError') return 'The sign-in service is not responding. Try again in a moment.';
  return error.message;
}
