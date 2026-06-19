import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo';
import { api, type MyReceipt } from '@mahal/shared/client/api-client';
import { formatCurrency } from '@mahal/shared/helpers/CurrencyHelper';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function ReceiptList() {
  const [receipts, setReceipts] = useState<MyReceipt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.receipts
      .getMyReceipts()
      .then((res) => setReceipts(res.receipts))
      .catch((e) => setError(e?.message ?? 'Failed to load receipts'));
  }, []);

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }
  if (!receipts) {
    return <ActivityIndicator style={styles.loading} />;
  }
  if (receipts.length === 0) {
    return <Text style={styles.muted}>No receipts yet.</Text>;
  }

  return (
    <FlatList
      data={receipts}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.rowTitle}>{item.title ?? 'Untitled receipt'}</Text>
          <Text style={styles.rowAmount}>{formatCurrency(item.userOwedAmount)}</Text>
        </View>
      )}
    />
  );
}

export default function HomeScreen() {
  const { user } = useUser();
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Mahal</Text>
      <SignedIn>
        <Text style={styles.muted}>Signed in as {user?.primaryEmailAddress?.emailAddress}</Text>
        <ReceiptList />
      </SignedIn>
      <SignedOut>
        <Text style={styles.muted}>Sign in to view your receipts.</Text>
      </SignedOut>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  heading: { fontSize: 32, fontWeight: '700', marginVertical: 16 },
  muted: { fontSize: 15, opacity: 0.6, marginBottom: 12 },
  error: { fontSize: 15, color: '#dc2626', marginTop: 12 },
  loading: { marginTop: 24 },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d5db',
  },
  rowTitle: { fontSize: 16 },
  rowAmount: { fontSize: 16, fontWeight: '600' },
});
