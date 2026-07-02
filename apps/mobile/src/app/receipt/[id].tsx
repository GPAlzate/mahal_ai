import { api } from '@mahal/shared/client/api-client';
import { formatCurrency } from '@mahal/shared/helpers/CurrencyHelper';
import type { ReceiptSummary } from '@mahal/shared/schemas/receipt/public/ReceiptSummary';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, Circle } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

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
  const [working, setWorking] = useState(false);

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

  async function finalize() {
    setWorking(true);
    try {
      setSummary(await api.receipts.finalize(receiptId));
    } catch (e) {
      Alert.alert('Could not finalize', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setWorking(false);
    }
  }

  async function settle() {
    setWorking(true);
    try {
      await api.receipts.settle(receiptId);
      await load();
    } catch (e) {
      Alert.alert('Could not settle', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setWorking(false);
    }
  }

  // Owner toggles whether a participant has paid (PNYP <-> PAID).
  async function togglePaid(participantId: number, current: string) {
    const next = current === 'PAID' ? 'PNYP' : 'PAID';
    try {
      await api.participants.updatePaymentStatus(receiptId, participantId, next);
      await load();
    } catch (e) {
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Try again.');
    }
  }

  const title = summary?.receipt.title || 'Receipt';
  const status = summary?.receipt.status ?? '';
  const editable = EDITABLE.has(status);
  const finalized = status === 'FLZD';
  const allPaid =
    !!summary &&
    summary.participantSplits.length > 0 &&
    summary.participantSplits.every((p) => p.paymentStatus === 'PAID');

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
                summary.participantSplits.map((p, i) => {
                  const paid = p.paymentStatus === 'PAID';
                  // Once finalized, the owner can tap a row to mark it paid/unpaid.
                  const canToggle = finalized || status === 'STLD';
                  return (
                    <Pressable
                      key={p.participantId}
                      disabled={!canToggle}
                      onPress={() => togglePaid(p.participantId, p.paymentStatus)}
                      className={`flex-row items-center justify-between py-2 ${
                        i > 0 ? 'border-t border-gray-100' : ''
                      }`}
                    >
                      <View className="flex-row items-center gap-2">
                        {canToggle ? (
                          paid ? (
                            <CheckCircle2 color="#16a34a" size={18} />
                          ) : (
                            <Circle color="#d1d5db" size={18} />
                          )
                        ) : null}
                        <Text className="text-base text-foreground">{p.displayName}</Text>
                      </View>
                      <Text
                        className={`text-base font-semibold ${
                          paid ? 'text-gray-400 line-through' : 'text-foreground'
                        }`}
                      >
                        {formatCurrency(p.total)}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </Card>
          </View>

          {editable ? (
            <View className="gap-2">
              <Button
                label="Assign items"
                onPress={() => router.push(`/receipt/${receiptId}/assign`)}
              />
              <Button label="Finalize" onPress={finalize} loading={working} />
            </View>
          ) : null}

          {finalized ? (
            <Button
              label={allPaid ? 'Mark settled' : 'Mark settled anyway'}
              onPress={settle}
              loading={working}
            />
          ) : null}
        </ScrollView>
      ) : null}
    </Screen>
  );
}
