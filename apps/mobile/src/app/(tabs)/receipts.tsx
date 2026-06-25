import { api, type MyReceipt } from '@mahal/shared/client/api-client';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';

import { ReceiptCard } from '@/components/ReceiptCard';
import { Muted, Screen, ScreenTitle } from '@/components/ui';

export default function ReceiptsScreen() {
  const [receipts, setReceipts] = useState<MyReceipt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.receipts.getMyReceipts();
      setReceipts(res.receipts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load receipts');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <Screen>
      <ScreenTitle>Receipts</ScreenTitle>
      {error ? <Text className="mt-3 text-base text-red-600">{error}</Text> : null}
      {!error && !receipts ? <ActivityIndicator className="mt-6" /> : null}
      {receipts ? (
        <FlatList
          data={receipts}
          keyExtractor={(r) => String(r.id)}
          contentContainerClassName="gap-3 pb-6"
          ItemSeparatorComponent={null}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Muted>No receipts yet.</Muted>}
          renderItem={({ item }) => (
            // TODO(Phase 5): onPress → receipt detail (assign/participants/summary by status).
            <ReceiptCard receipt={item} />
          )}
        />
      ) : null}
    </Screen>
  );
}
