import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { get, writable } from 'svelte/store';

type Auth0Client = import('@auth0/auth0-spa-js').Auth0Client;

export interface AuthState {
  loading: boolean;
  configured: boolean;
  isAuthenticated: boolean;
  user?: { sub?: string; name?: string; email?: string; picture?: string };
}

const domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined;

export const authState = writable<AuthState>({
  loading: true,
  configured: Boolean(domain && clientId && audience),
  isAuthenticated: false
});

let client: Auth0Client | undefined;
let initializing: Promise<void> | undefined;

export function initializeAuth0(): Promise<void> {
  if (!browser) return Promise.resolve();
  if (initializing) return initializing;
  initializing = (async () => {
    if (!domain || !clientId || !audience) {
      authState.set({ loading: false, configured: false, isAuthenticated: false });
      return;
    }
    const { createAuth0Client } = await import('@auth0/auth0-spa-js');
    client = await createAuth0Client({
      domain,
      clientId,
      cacheLocation: 'memory',
      useRefreshTokens: true,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience,
        scope: 'openid profile email read:library write:library read:progress write:progress'
      }
    });
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has('code') && currentUrl.searchParams.has('state')) {
      const { appState } = await client.handleRedirectCallback();
      const returnTo = typeof appState?.returnTo === 'string' && appState.returnTo.startsWith('/') ? appState.returnTo : '/';
      await goto(returnTo, { replaceState: true });
    }
    const user = await client.getUser();
    authState.set({ loading: false, configured: true, isAuthenticated: Boolean(user), user });
  })().catch(() => {
    authState.set({ loading: false, configured: Boolean(domain && clientId && audience), isAuthenticated: false });
  });
  return initializing;
}

export async function login(): Promise<void> {
  if (!client) throw new Error('Auth0 is not configured.');
  await client.loginWithRedirect({ appState: { returnTo: window.location.pathname + window.location.search } });
}

export async function logout(): Promise<void> {
  if (!client) return;
  await client.logout({ logoutParams: { returnTo: window.location.origin } });
}

export async function getAccessToken(): Promise<string | undefined> {
  if (!client || !get(authState).isAuthenticated) return undefined;
  return client.getTokenSilently({ authorizationParams: { audience } });
}