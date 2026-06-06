import type { EvaluateResponse } from '../api.ts';

const ACTION_CLASS: Record<string, string> = {
  allow: 'verdict-allow',
  challenge: 'verdict-challenge',
  deny: 'verdict-deny',
};

function Verdict({ response }: { response: EvaluateResponse }) {
  const action = response.result.policy?.action;
  if (!action) return null;

  const score = response.result.risk;
  const signals = Object.keys(response.result.signals ?? {});

  return (
    <div>
      <div className={`verdict ${ACTION_CLASS[action] ?? ''}`}>
        <span className="verdict-action">{action}</span>
        {typeof score === 'number' && (
          <span className="text-[0.9rem] text-muted">
            risk score {score.toFixed(2)}
          </span>
        )}
      </div>
      {signals.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {signals.map((name) => (
            <span key={name} className="chip">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ResultPanel({ response }: { response: EvaluateResponse }) {
  return (
    <div className="card mt-6">
      <div className="eyebrow">result</div>

      <div className="mt-1 mb-3 text-[0.9rem] text-muted">
        Castle endpoint <code>/{response.api_endpoint}</code> ·{' '}
        <code>
          {response.castle_type} / {response.castle_status}
        </code>
      </div>

      {response.result.error ? (
        <div className="verdict verdict-deny">
          <span className="verdict-action">error</span>
          <span className="text-[0.9rem] text-muted">{response.result.error}</span>
        </div>
      ) : (
        <Verdict response={response} />
      )}

      <div className="mt-4 text-[0.78rem] font-bold uppercase tracking-wide text-muted">
        Payload sent to Castle
      </div>
      <pre className="json mt-1.5">
        {JSON.stringify(response.payload_to_castle, null, 2)}
      </pre>

      <div className="mt-4 text-[0.78rem] font-bold uppercase tracking-wide text-muted">
        Response from Castle
      </div>
      <pre className="json mt-1.5">{JSON.stringify(response.result, null, 2)}</pre>
    </div>
  );
}
