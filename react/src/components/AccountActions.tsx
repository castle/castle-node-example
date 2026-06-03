import { useState } from 'react';

import { evaluateLogout, type EvaluateResponse } from '../api.ts';
import { useCastle } from '../castle/CastleProvider.tsx';
import type { AccountUser } from '../config.ts';

interface AccountActionsProps {
  user: AccountUser;
  onResult: (response: EvaluateResponse) => void;
}

export function AccountActions({ user, onResult }: AccountActionsProps) {
  const { createRequestToken, trackCustom } = useCastle();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      // The logout is recorded with a fresh token via the log endpoint.
      const requestToken = await createRequestToken();
      const response = await evaluateLogout(requestToken);
      onResult(response);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="card mt-6">
      <div className="eyebrow">react · session</div>
      <h2 className="text-[1.15rem]">Session</h2>
      <p className="mt-1 text-[0.9rem] text-muted">
        Fire a custom event (<code>Castle.custom</code>) or log out
        (<code>$logout</code> via the non-blocking log endpoint).
      </p>

      <div className="btn-row">
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() =>
            trackCustom({
              name: '$custom',
              user: { id: user.id ?? user.email, email: user.email },
              properties: { source: 'react-account' },
            })
          }
        >
          Send a custom event
        </button>
        <button className="btn" type="button" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? 'Logging out…' : 'Log out'}
        </button>
      </div>
    </div>
  );
}
