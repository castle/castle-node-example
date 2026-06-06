import { useState, type FormEvent } from 'react';

import { evaluateProfileUpdate, type EvaluateResponse } from '../api.ts';
import { useCastle } from '../castle/CastleProvider.tsx';
import type { AccountUser } from '../config.ts';

interface ProfileFormProps {
  user: AccountUser;
  onResult: (response: EvaluateResponse) => void;
}

export function ProfileForm({ user, onResult }: ProfileFormProps) {
  const { createRequestToken, isConfigured } = useCastle();

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Mint a fresh request token for this update, then hand it to the backend
      // which forwards it to Castle as a $profile_update event.
      const requestToken = await createRequestToken();
      const response = await evaluateProfileUpdate({ name, email, requestToken });
      onResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div className="eyebrow">react · workflow</div>
      <h2 className="text-[1.15rem]">Update your profile</h2>
      <p className="mt-1 text-[0.9rem] text-muted">
        Signed in as <code>{user.email}</code>. Changing your name or email sends
        a <code>$profile_update</code> event to Castle and shows the verdict.
      </p>

      {!isConfigured && (
        <p className="mt-2 text-[0.85rem] text-challenge">
          No publishable key configured — the update is sent without a token.
        </p>
      )}

      <form className="mt-4" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">name</label>
          <input
            id="name"
            className="input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="email">email</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error && <p className="mb-2 text-[0.85rem] text-danger">{error}</p>}

        <div className="btn-row">
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
