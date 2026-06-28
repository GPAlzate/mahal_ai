import { api } from '@mahal/shared/client/api-client';
import { formatCurrency } from '@mahal/shared/helpers/CurrencyHelper';
import type { ReceiptSummary } from '@mahal/shared/schemas/receipt/public/ReceiptSummary';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { ReceiptStatusBadge } from '@/components/ReceiptStatusBadge';
import { Button, Card, Header, Muted, Screen } from '@/components/ui';

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className={`text-base ${bold ? 'font-bold text-foreground' : 'text-gray-600'}`}>
        {label}
      </Text>
      <Text className={`text-base ${bold ? 'font-bold text-foreground' : 'text-gray-800'}`}>
        {value}
      </Text>
    </View>
  );
}

// Receipt statuses where the owner can still edit line-item assignments.
const EDITABLE = new Set(['DRFT', 'ULIP', 'PRSP']);

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const receiptId = Number(id);
  const router = useRouter();

  const [summary, setSummary] = useState<ReceiptSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await api.receipts.getSummary(receiptId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load receipt');
    }
  }, [receiptId]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = summary?.receipt.title || 'Receipt';

  return (
    <Screen>
      <Header
        title={title}
        right={summary ? <ReceiptStatusBadge status={summary.receipt.status} /> : undefined}
      />

      {error ? <Text className="mt-3 text-base text-red-600">{error}</Text> : null}
      {!error && !summary ? <ActivityIndicator className="mt-6" /> : null}

      {summary ? (
        <ScrollView contentContainerClassName="gap-4 pb-8" showsVerticalScrollIndicator={false}>
          {/* Totals breakdown */}
          <Card>
            <Row label="Subtotal" value={formatCurrency(summary.subtotal)} />
            {summary.tax ? <Row label="Tax" value={formatCurrency(summary.tax)} /> : null}
            {summary.tip ? <Row label="Tip" value={formatCurrency(summary.tip)} /> : null}
            {summary.serviceCharge ? (
              <Row label="Service" value={formatCurrency(summary.serviceCharge)} />
            ) : null}
            {summary.discount ? (
              <Row label="Discount" value={`-${formatCurrency(Math.abs(summary.discount))}`} />
            ) : null}
            <View className="my-1 h-px bg-gray-200" />
            <Row label="Total" value={formatCurrency(summary.total)} bold />
          </Card>

          {/* Per-participant splits */}
          <View className="gap-1">
            <View className="flex-row items-center justify-between">
              <Muted>Who owes what</Muted>
              <Pressable onPress={() => router.push(`/receipt/${receiptId}/participants`)} hitSlop={8}>
                <Text className="text-sm font-semibold text-blue-600">Manage people</Text>
              </Pressable>
            </View>
            <Card>
              {summary.participantSplits.length === 0 ? (
                <Text className="text-gray-500">No participants yet.</Text>
              ) : (
                summary.participantSplits.map((p, i) => (
                  <View
                    key={p.participantId}
                    className={`flex-row items-center justify-between py-2 ${
                      i > 0 ? 'border-t border-gray-100' : ''
                    }`}
                  >
                    <Text className="text-base text-foreground">{p.displayName}</Text>
                    <Text className="text-base font-semibold text-foreground">
                      {formatCurrency(p.total)}
                    </Text>
                  </View>
                ))
              )}
            </Card>
          </View>

          {summary.receipt.status && EDITABLE.has(summary.receipt.status) ? (
            <Button
              label="Assign items"
              onPress={() => router.push(`/receipt/${receiptId}/assign`)}
            />
          ) : null}
        </ScrollView>
      ) : null}
    </Screen>
  );
}
