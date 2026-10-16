import { type ApiClient, ApiError, SessionCancelled, safeError } from '@api/api';
import { createAuthClient } from 'better-auth/react';
import { z } from 'zod';
import { accountSchema, type PasswordInput, type SignInInput } from './schemas';

const sessionView = z.object({ user: accountSchema });
const endpoints: Record<string, string> = {
  '/get-session': '/auth/me',
  '/sign-in/email': '/auth/sign-in',
  '/sign-out': '/auth/sign-out',
  '/change-password': '/auth/change-password',
};

/** All auth requests pass through this facade; backend routes/policies stay authoritative. */
export function createAuthApi(client: ApiClient) {
  let blockedUntil = 0;
  let sessionFailure: ApiError | undefined;
  const baseURL = new URL(client.baseUrl, window.location.origin);
  const basePath = `${baseURL.pathname.replace(/\/$/, '')}/auth`;
  const auth = createAuthClient({
    baseURL: baseURL.origin,
    basePath,
    disableDefaultFetchPlugins: true,
    fetchOptions: {
      retry: 0,
      // Keep the API's timestamp strings intact for the feature Zod schema.
      jsonParser: (text) => (text ? JSON.parse(text) : null),
      customFetchImpl: async (input, init) => {
        const path = new URL(
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
        ).pathname.slice(basePath.length);
        const url = endpoints[path];
        if (!url) throw new ApiError(400, 'This authentication operation is not available.');
        const checking = path === '/get-session';
        if (checking && Date.now() < blockedUntil) throw sessionFailure;
        try {
          const result = await client.request({
            url,
            method: init?.method ?? 'GET',
            signal: init?.signal ?? undefined,
            data: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
            auth: true,
          });
          if (checking || path === '/sign-in/email') {
            const parsed = accountSchema.safeParse(result);
            if (!parsed.success)
              throw new ApiError(
                502,
                'The server returned an invalid account response. Try again.',
              );
            blockedUntil = 0;
            sessionFailure = undefined;
            // Better Auth's session store accepts a custom view. Only the public
            // account is needed; never fabricate a token or session metadata.
            return Response.json({ user: parsed.data });
          }
          return new Response(null, { status: 204 });
        } catch (error) {
          if (error instanceof SessionCancelled) throw error;
          const normalized = safeError(error);
          if (checking && normalized.status === 401) {
            blockedUntil = 0;
            sessionFailure = undefined;
            return Response.json(null);
          }
          if (checking) {
            blockedUntil = Math.max(normalized.retryAt, Date.now() + 2_000);
            sessionFailure = new ApiError(normalized.status, normalized.message, blockedUntil);
            throw sessionFailure;
          }
          // Throw the safe application error, retaining Retry-After without
          // retaining Axios request bodies or server diagnostics.
          throw normalized;
        }
      },
    },
  });
  const atom = auth.$store.atoms.session;
  if (!atom) throw new Error('Better Auth session store is unavailable.');
  const read = () => {
    const state = atom.get();
    const parsed = state.data == null ? undefined : sessionView.safeParse(state.data);
    return {
      snapshot: state,
      account: parsed?.success ? parsed.data.user : undefined,
      error: state.error
        ? state.error instanceof SessionCancelled
          ? state.error
          : safeError(state.error)
        : parsed && !parsed.success
          ? new ApiError(502, 'The server returned an invalid account response. Try again.')
          : undefined,
      pending: state.isPending || state.isRefetching,
    };
  };
  return {
    read,
    subscribe: (listener: () => void) => atom.subscribe(listener),
    recheck: () => atom.get().refetch(),
    clear: () => {
      atom.set({ ...atom.get(), data: null, error: null, isPending: false, isRefetching: false });
      return atom.get();
    },
    signIn: async (data: SignInInput) => {
      const result = await auth.signIn.email(data, { disableSignal: true });
      if (result.error) throw safeError(result.error);
      const account = sessionView.parse(result.data).user;
      atom.set({
        ...atom.get(),
        data: { user: account },
        error: null,
        isPending: false,
        isRefetching: false,
      });
      return account;
    },
    signOut: async () => {
      const result = await auth.signOut();
      if (result.error) throw safeError(result.error);
    },
    changePassword: async ({ currentPassword, newPassword }: PasswordInput) => {
      const result = await auth.changePassword({ currentPassword, newPassword });
      if (result.error) throw safeError(result.error);
    },
  };
}
