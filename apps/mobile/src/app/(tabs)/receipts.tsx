import { api, type MyReceipt } from '@mahal/shared/client/api-client';
import { formatCurrency } from '@mahal/shared/helpers/CurrencyHelper';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';

import { Muted, Screen, ScreenTitle } from '@/components/ui';

export default function ReceiptsScreen() {
  const [receipts, setReceipts] = useState<MyReceipt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.receipts
      .getMyReceipts()
      .then((res) => setReceipts(res.receipts))
      .catch((e) => setError(e?.message ?? 'Failed to load receipts'));
  }, []);

  return (
    <Screen>
      <ScreenTitle>Receipts</ScreenTitle>
      {error ? <Text className="mt-3 text-base text-red-600">{error}</Text> : null}
      {!error && !receipts ? <ActivityIndicator className="mt-6" /> : null}
      {receipts?.length === 0 ? <Muted>No receipts yet.</Muted> : null}
      {receipts && receipts.length > 0 ? (
        <FlatList
          data={receipts}
          keyExtractor={(r) => String(r.id)}
          ItemSeparatorComponent={() => <View className="h-px bg-gray-200" />}
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between py-4">
              <Text className="text-base text-foreground">{item.title ?? 'Untitled receipt'}</Text>
              <Text className="text-base font-semibold text-foreground">
                {formatCurrency(item.userOwedAmount)}
              </Text>
            </View>
          )}
        />
      ) : null}
    </Screen>
  );
}
