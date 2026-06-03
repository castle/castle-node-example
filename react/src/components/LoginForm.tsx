import { useState, type FormEvent } from 'react';

import { evaluateLogin, type EvaluateLoginResponse } from '../api.ts';
import { useCastle } from '../castle/CastleProvider.tsx';

interface LoginFormProps {
  onResult: (response: EvaluateLoginResponse) => void;
}

export function LoginForm({ onResult }: LoginFormProps) {
  const { createRequestToken, isConfigured, trackCustom } = useCastle();

  const [email, setEmail] = useState('clark.kent@dailyplanet.com');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Mint a fresh request token for this action, then hand it to the
      // backend which forwards it to Castle's risk / filter endpoint.
      const requestToken = await createRequestToken();
      const response = await evaluateLogin({ email, password, requestToken });
      onResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div className="eyebrow">workflow</div>
      <h2 className="text-[1.15rem]">login</h2>

      {!isConfigured && (
        <p className="mt-2 text-[0.85rem] text-challenge">
          No <code>VITE_CASTLE_PK</code> configured — requests are sent without a
          token. Add it to <code>react/.env</code> to mint real tokens.
        </p>
      )}

      <form className="mt-4" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">email</label>
          <input
            id="email"
            className="input"
            type="text"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">password</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="mb-2 text-[0.85rem] text-danger">{error}</p>}

        <div className="btn-row">
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Evaluating…' : 'Log in'}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() =>
              trackCustom({
                name: '$custom',
                user: { id: email },
                properties: { source: 'react-demo' },
              })
            }
          >
            Send a custom event
          </button>
        </div>
      </form>
    </div>
  );
}
