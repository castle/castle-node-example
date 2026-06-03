export interface CastleResult {
  risk?: number;
  policy?: { action?: string; name?: string; id?: string };
  signals?: Record<string, unknown>;
  error?: string;
  [key: string]: unknown;
}

export interface EvaluateResponse {
  api_endpoint: string;
  payload_to_castle: Record<string, unknown>;
  result: CastleResult;
  castle_type: string;
  castle_status: string;
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Request to ${url} failed with status ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface ProfileUpdateInput {
  name: string;
  email: string;
  requestToken: string;
}

/** Evaluate a profile update ($profile_update) through the Express backend. */
export function evaluateProfileUpdate(
  input: ProfileUpdateInput,
): Promise<EvaluateResponse> {
  return postJSON<EvaluateResponse>('/evaluate_profile_update', {
    name: input.name,
    email: input.email,
    request_token: input.requestToken,
  });
}

/** Record a logout ($logout) via the non-blocking log endpoint. */
export function evaluateLogout(requestToken: string): Promise<EvaluateResponse> {
  return postJSON<EvaluateResponse>('/evaluate_logout', {
    request_token: requestToken,
  });
}
