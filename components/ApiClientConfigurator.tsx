'use client';

import { configureApiClient } from '@/lib/client/api-client';
import { getShareCode, rememberShareCode } from '@/lib/client/shareCodeStore';

/**
 * Teaches the API client how to prove receipt access for guests.
 *
 * Runs at module scope rather than in an effect so the configuration is in
 * place before any page component can fire its first request. Renders nothing.
 */
configureApiClient({ getShareCode, rememberShareCode });

export function ApiClientConfigurator() {
  return null;
}
