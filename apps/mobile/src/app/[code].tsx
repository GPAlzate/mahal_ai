import { api } from '@mahal/shared/client/api-client';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Header, Muted, Screen } from '@/components/ui';

/**
 * Deep-link target for shared receipt links (https://<domain>/<CODE>).
 * Resolves the share code and forwards to the screen that matches the
 * receipt's status, mirroring the web /[code] page's routing.
 */
export default function ShareCodeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      return;
    }
    let cancelled = false;

    api.receipts
      .getByShareCode(code.toUpperCase())
      .then((receipt) => {
        if (cancelled) {
          return;
        }
        if (receipt.status === 'ULIP' || receipt.status === 'PRSP') {
          router.replace(`/receipt/${receipt.id}/participants`);
        } else if (receipt.status === 'DRFT') {
          router.replace(`/receipt/${receipt.id}/assign`);
        } else {
          router.replace(`/receipt/${receipt.id}`);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load receipt');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, router]);

  return (
    <Screen>
      <Header title={code ? code.toUpperCase() : 'Receipt'} />
      {error ? (
        <Muted className="mt-6 text-center">{error}</Muted>
      ) : (
        <ActivityIndicator className="mt-6" />
      )}
    </Screen>
  );
}
