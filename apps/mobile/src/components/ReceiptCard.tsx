import { type MyReceipt } from '@mahal/shared/client/api-client';
import { formatCurrency } from '@mahal/shared/helpers/CurrencyHelper';
import { Pressable, Text, View } from 'react-native';

import { ReceiptStatusBadge } from './ReceiptStatusBadge';

function formatParticipants(names: string[]): string | null {
  if (names.length === 0) {
    return null;
  }
  const shown = names.slice(0, 2);
  const rest = names.length - shown.length;
  const suffix = rest > 0 ? ` and ${rest} other${rest > 1 ? 's' : ''}` : '';
  return 'with ' + shown.join(', ') + suffix;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ReceiptCard({ receipt, onPress }: { receipt: MyReceipt; onPress?: () => void }) {
  const participants = formatParticipants(receipt.participantNames);

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 active:bg-gray-50"
    >
      <View className="min-w-0 flex-1 gap-0.5">
        <Text numberOfLines={1} className="text-base font-bold text-foreground">
          {receipt.title || 'Untitled receipt'}
        </Text>
        <Text className="text-xs text-gray-500">{formatDate(receipt.receiptTime)}</Text>
        {participants ? (
          <Text numberOfLines={1} className="text-xs text-gray-400">
            {participants}
          </Text>
        ) : null}
      </View>

      <View className="items-end gap-1">
        {receipt.userOwedAmount > 0 ? (
          <Text className="text-base font-bold text-foreground">
            {formatCurrency(receipt.userOwedAmount)}
          </Text>
        ) : null}
        <ReceiptStatusBadge status={receipt.status} />
      </View>
    </Pressable>
  );
}
