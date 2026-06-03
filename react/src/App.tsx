import { useState } from 'react';

import type { EvaluateLoginResponse } from './api.ts';
import { LoginForm } from './components/LoginForm.tsx';
import { ResultPanel } from './components/ResultPanel.tsx';

export function App() {
  const [result, setResult] = useState<EvaluateLoginResponse | null>(null);

  return (
    <main className="mx-auto max-w-[680px] px-6 pb-16 pt-12">
      <header className="mb-8 text-center">
        <span className="tag">castle browser sdk · react</span>
        <h1 className="mt-3 text-[2rem] font-semibold">Castle React demo</h1>
        <p className="mt-2 text-muted">
          A React + Vite front end that mints a Castle request token in the browser
          and evaluates a login through the Express backend.
        </p>
      </header>

      <LoginForm onResult={setResult} />

      {result && <ResultPanel response={result} />}
    </main>
  );
}
