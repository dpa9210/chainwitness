/**
 * The MWA auth_token, shared across every module that opens a `transact()`
 * session (mwaClient.ts, solanaClient.ts), so a session opened for signing
 * a message and one opened for sending a transaction reauthorize against
 * the same cached token instead of prompting the user for full approval
 * twice. In-memory only for now — resets on app restart (fine for the
 * hackathon build; persisting via AsyncStorage is a later polish pass).
 */
let authToken: string | undefined;

export function getAuthToken(): string | undefined {
  return authToken;
}

export function setAuthToken(token: string | undefined): void {
  authToken = token;
}
