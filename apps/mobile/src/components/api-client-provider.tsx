import { useAuth } from '@clerk/clerk-expo';
import { configureApiClient } from '@mahal/shared/client/api-client';
import { type ReactNode, useEffect } from 'react';

/**
 * Points the shared API client at the deployed Next.js backend and injects the
 * Clerk session token on every request.
 *
 * On web the same client uses relative URLs + Clerk cookies; native has neither,
 * so we set an absolute base URL and a Bearer token (verified by clerkMiddleware
 * on the server).
 */
export function ApiClientProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    configureApiClient({
      baseUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
      getAuthHeaders: async (): Promise<Record<string, string>> => {
        const token = await getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    });
  }, [getToken]);

  return <>{children}</>;
}
