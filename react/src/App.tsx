import { useState } from 'react';

import type { EvaluateResponse } from './api.ts';
import type { AccountUser } from './config.ts';
import { AccountActions } from './components/AccountActions.tsx';
import { ProfileForm } from './components/ProfileForm.tsx';
import { ResultPanel } from './components/ResultPanel.tsx';

export function App({ user }: { user: AccountUser }) {
  const [result, setResult] = useState<EvaluateResponse | null>(null);

  return (
    <div>
      <ProfileForm user={user} onResult={setResult} />
      <AccountActions user={user} onResult={setResult} />
      {result && <ResultPanel response={result} />}
    </div>
  );
}
