import { api } from '@mahal/shared/client/api-client';
import { formatCurrency } from '@mahal/shared/helpers/CurrencyHelper';
import type { Participant } from '@mahal/shared/schemas/participant/public/Participant';
import type { ReceiptLine } from '@mahal/shared/schemas/receipt/public/ReceiptLine';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button, Card, Header, Muted, Screen } from '@/components/ui';

/** lineId -> participantId -> unit count (0 = not on this line). */
type UnitMap = Record<number, Record<number, number>>;
/** lineId -> participantId -> stored shareQuantity (fraction of the line). */
type ShareMap = Record<number, Record<number, number>>;

const EPS = 1e-9;

// Assignable line types grouped into UI sections. Leaving a charge/discount
// unassigned splits it proportionally (the summary's default behavior).
const SECTIONS: { title: string; types: string[]; hint?: string }[] = [
  { title: 'Items', types: ['PRCH'] },
  { title: 'Charges', types: ['TIP', 'SRVC', 'DADJ'], hint: 'Leave unassigned to split proportionally.' },
  { title: 'Discounts', types: ['DSCT'], hint: 'Leave unassigned to split proportionally.' },
];

/** Reconstructs integer unit counts from stored fractional shares on a line. */
function sharesToUnits(shares: Record<number, number>): Record<number, number> {
  const values = Object.values(shares).filter((v) => v > EPS);
  if (values.length === 0) {
    return {};
  }
  const min = Math.min(...values);
  const units: Record<number, number> = {};
  for (const pid of Object.keys(shares)) {
    const u = Math.round(shares[+pid] / min);
    if (u > 0) {
      units[+pid] = u;
    }
  }
  return units;
}

export default function AssignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const receiptId = Number(id);
  const router = useRouter();

  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [units, setUnits] = useState<UnitMap>({});
  const [initialUnits, setInitialUnits] = useState<UnitMap>({});
  const [initialShare, setInitialShare] = useState<ShareMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    const [allLines, people] = await Promise.all([
      api.lines.list(receiptId),
      api.participants.list(receiptId),
    ]);
    const assignable = allLines.filter((l) => l.receiptLineType !== 'TAX');

    const entries = await Promise.all(
      assignable.map(async (line) => {
        const a = await api.assignments.list(receiptId, line.id);
        const shares: Record<number, number> = {};
        for (const x of a) {
          shares[x.participantId] = x.shareQuantity;
        }
        return [line.id, shares] as const;
      })
    );

    const shareMap: ShareMap = {};
    const unitMap: UnitMap = {};
    for (const [lineId, shares] of entries) {
      shareMap[lineId] = shares;
      unitMap[lineId] = sharesToUnits(shares);
    }

    setLines(assignable);
    setParticipants(people);
    setUnits(unitMap);
    setInitialUnits(unitMap);
    setInitialShare(shareMap);
    setLoading(false);
  }, [receiptId]);

  useEffect(() => {
    load().catch((e) => {
      Alert.alert('Failed to load', e instanceof Error ? e.message : 'Try again.');
      setLoading(false);
    });
  }, [load]);

  const dirty = useMemo(
    () => JSON.stringify(units) !== JSON.stringify(initialUnits),
    [units, initialUnits]
  );

  function setUnit(lineId: number, pid: number, next: number) {
    setUnits((prev) => {
      const line = { ...(prev[lineId] ?? {}) };
      if (next <= 0) {
        delete line[pid];
      } else {
        line[pid] = next;
      }
      return { ...prev, [lineId]: line };
    });
  }

  async function addParticipant() {
    const name = newName.trim();
    if (!name) {
      return;
    }
    try {
      const [created] = await api.participants.create(receiptId, [{ displayName: name }]);
      setParticipants((p) => [...p, created]);
      setNewName('');
    } catch (e) {
      Alert.alert('Could not add', e instanceof Error ? e.message : 'Try again.');
    }
  }

  async function save() {
    setSaving(true);
    try {
      for (const line of lines) {
        const lineUnits = units[line.id] ?? {};
        const total = Object.values(lineUnits).reduce((a, b) => a + b, 0);
        const prevShares = initialShare[line.id] ?? {};
        const pids = new Set<number>([
          ...Object.keys(lineUnits).map(Number),
          ...Object.keys(prevShares).map(Number),
        ]);

        for (const pid of pids) {
          const nextShare = total > 0 ? (lineUnits[pid] ?? 0) / total : 0;
          const prevShare = prevShares[pid] ?? 0;
          if (nextShare > EPS && Math.abs(nextShare - prevShare) > EPS) {
            await api.assignments.assign(receiptId, line.id, pid, nextShare);
          } else if (nextShare <= EPS && prevShare > EPS) {
            await api.assignments.unassign(receiptId, line.id, pid);
          }
        }
      }
      router.back();
    } catch (e) {
      Alert.alert('Failed to save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  function renderLine(line: ReceiptLine) {
    const lineUnits = units[line.id] ?? {};
    const total = Object.values(lineUnits).reduce((a, b) => a + b, 0);

    return (
      <Card key={line.id}>
        <View className="flex-row justify-between">
          <Text className="flex-1 text-base font-semibold text-foreground">{line.itemName}</Text>
          <Text className="ml-3 text-base font-semibold text-foreground">
            {formatCurrency(line.totalPrice)}
          </Text>
        </View>

        {participants.length > 0 ? (
          <View className="mt-3 flex-row flex-wrap gap-2">
            {participants.map((p) => {
              const count = lineUnits[p.id] ?? 0;
              const on = count > 0;
              // Show each person's currency share once shares are uneven.
              const showShare = on && total > 0 && Object.keys(lineUnits).length > 1;

              if (!on) {
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setUnit(line.id, p.id, 1)}
                    className="rounded-full border border-gray-300 bg-white px-3 py-1.5"
                  >
                    <Text className="text-gray-700">{p.displayName}</Text>
                  </Pressable>
                );
              }
              return (
                <View
                  key={p.id}
                  className="flex-row items-center gap-2 rounded-full bg-black py-1 pl-3 pr-1"
                >
                  <Pressable onPress={() => setUnit(line.id, p.id, 0)}>
                    <Text className="font-medium text-white">
                      {p.displayName}
                      {showShare ? ` · ${formatCurrency((line.totalPrice * count) / total)}` : ''}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setUnit(line.id, p.id, count - 1)}
                    hitSlop={6}
                    className="h-6 w-6 items-center justify-center rounded-full bg-white/20"
                  >
                    <Minus color="#fff" size={14} />
                  </Pressable>
                  <Text className="min-w-4 text-center font-semibold text-white">{count}</Text>
                  <Pressable
                    onPress={() => setUnit(line.id, p.id, count + 1)}
                    hitSlop={6}
                    className="h-6 w-6 items-center justify-center rounded-full bg-white/20"
                  >
                    <Plus color="#fff" size={14} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}
      </Card>
    );
  }

  if (loading) {
    return (
      <Screen>
        <Header title="Assign items" />
        <ActivityIndicator className="mt-6" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Assign items" />

      <ScrollView contentContainerClassName="gap-4 pb-8" showsVerticalScrollIndicator={false}>
        <Card>
          <Muted>People</Muted>
          <View className="mt-2 flex-row items-center gap-2">
            <TextInput
              className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-base"
              placeholder="Add a person"
              placeholderTextColor="#9ca3af"
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={addParticipant}
              autoCapitalize="words"
              returnKeyType="done"
            />
            <Pressable onPress={addParticipant} className="rounded-xl bg-black px-4 py-2.5 active:bg-gray-800">
              <Text className="font-semibold text-white">Add</Text>
            </Pressable>
          </View>
          {participants.length === 0 ? (
            <Text className="mt-2 text-sm text-gray-400">Add people to split items between.</Text>
          ) : (
            <Text className="mt-2 text-xs text-gray-400">
              Tap a name to add them; use − / + to give someone a bigger share.
            </Text>
          )}
        </Card>

        {lines.length === 0 ? (
          <Muted>Nothing to assign.</Muted>
        ) : (
          SECTIONS.map((section) => {
            const sectionLines = lines.filter((l) => section.types.includes(l.receiptLineType));
            if (sectionLines.length === 0) {
              return null;
            }
            return (
              <View key={section.title} className="gap-2">
                <Muted>{section.title}</Muted>
                {section.hint ? <Text className="text-xs text-gray-400">{section.hint}</Text> : null}
                {sectionLines.map((line) => renderLine(line))}
              </View>
            );
          })
        )}
      </ScrollView>

      <View className="mb-4">
        <Button label={dirty ? 'Save assignments' : 'Done'} onPress={save} loading={saving} />
      </View>
    </Screen>
  );
}
