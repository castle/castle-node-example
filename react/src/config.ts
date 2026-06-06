export interface AccountUser {
  id?: string;
  email: string;
  name: string;
}

export interface AccountConfig {
  pk?: string;
  user: AccountUser;
}

declare global {
  interface Window {
    CASTLE_ACCOUNT?: {
      pk?: string | null;
      user?: Partial<AccountUser> | null;
    };
  }
}

const DEFAULT_USER: AccountUser = {
  id: undefined,
  email: 'clark.kent@dailyplanet.com',
  name: 'Clark Kent',
};

/**
 * Read the config injected by the server-rendered shell, falling back to the
 * Vite env / defaults so the app also runs standalone (`npm run dev`).
 */
export function readAccountConfig(): AccountConfig {
  const injected = typeof window !== 'undefined' ? window.CASTLE_ACCOUNT : undefined;

  return {
    pk: injected?.pk ?? import.meta.env.VITE_CASTLE_PK,
    user: {
      id: injected?.user?.id ?? DEFAULT_USER.id,
      email: injected?.user?.email ?? DEFAULT_USER.email,
      name: injected?.user?.name ?? DEFAULT_USER.name,
    },
  };
}
