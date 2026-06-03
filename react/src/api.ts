export interface CastleResult {
  risk?: number;
  policy?: { action?: string; name?: string; id?: string };
  signals?: Record<string, unknown>;
  error?: string;
  [key: string]: unknown;
}

export interface EvaluateLoginResponse {
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

export interface LoginInput {
  email: string;
  password: string;
  requestToken: string;
}

export function evaluateLogin(input: LoginInput): Promise<EvaluateLoginResponse> {
  return postJSON<EvaluateLoginResponse>('/evaluate_login', {
    email: input.email,
    password: input.password,
    request_token: input.requestToken,
  });
}
