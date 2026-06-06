import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  configure,
  createRequestToken,
  custom,
  type CustomParams,
} from '@castleio/castle-js';

interface CastleContextValue {
  /** Whether a publishable key was provided and the SDK is configured. */
  readonly isConfigured: boolean;
  /**
   * Mint a fresh Castle request token. Always resolves: when the SDK is not
   * configured it returns an empty string so callers can submit regardless.
   */
  createRequestToken: () => Promise<string>;
  /** Send a custom event (Castle.custom). No-op when not configured. */
  trackCustom: (params: CustomParams) => void;
}

const CastleContext = createContext<CastleContextValue | null>(null);

interface CastleProviderProps {
  publishableKey?: string;
  children: ReactNode;
}

/**
 * Configures the Castle browser SDK exactly once and exposes a small, typed
 * API to the rest of the app. `configure` must run a single time for the
 * lifetime of the page, so we guard it against React StrictMode's double mount.
 */
export function CastleProvider({ publishableKey, children }: CastleProviderProps) {
  const isConfigured = Boolean(publishableKey);
  const configuredRef = useRef(false);

  useEffect(() => {
    if (!publishableKey || configuredRef.current) return;
    configure({ pk: publishableKey });
    configuredRef.current = true;
  }, [publishableKey]);

  const value = useMemo<CastleContextValue>(
    () => ({
      isConfigured,
      createRequestToken: async () => {
        if (!isConfigured) return '';
        try {
          return await createRequestToken();
        } catch (err) {
          console.error('Castle.createRequestToken failed', err);
          return '';
        }
      },
      trackCustom: (params) => {
        if (isConfigured) custom(params);
      },
    }),
    [isConfigured],
  );

  return <CastleContext.Provider value={value}>{children}</CastleContext.Provider>;
}

export function useCastle(): CastleContextValue {
  const ctx = useContext(CastleContext);
  if (!ctx) {
    throw new Error('useCastle must be used within a <CastleProvider>');
  }
  return ctx;
}
