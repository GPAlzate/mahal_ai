import { api } from '@mahal/shared/client/api-client';
import type { Participant } from '@mahal/shared/schemas/participant/public/Participant';
import { useLocalSearchParams } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Card, Header, Muted, Screen } from '@/components/ui';

export default function ParticipantsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const receiptId = Number(id);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    setParticipants(await api.participants.list(receiptId));
    setLoading(false);
  }, [receiptId]);

  useEffect(() => {
    load().catch((e) => {
      Alert.alert('Failed to load', e instanceof Error ? e.message : 'Try again.');
      setLoading(false);
    });
  }, [load]);

  async function add() {
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

  // Persist a rename when the field loses focus, reverting on failure.
  async function rename(participant: Participant, displayName: string) {
    const trimmed = displayName.trim();
    if (!trimmed || trimmed === participant.displayName) {
      return;
    }
    try {
      await api.participants.update(receiptId, participant.id, trimmed);
    } catch (e) {
      Alert.alert('Could not rename', e instanceof Error ? e.message : 'Try again.');
      await load();
    }
  }

  function confirmRemove(participant: Participant) {
    Alert.alert('Remove person', `Remove ${participant.displayName} from this receipt?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.participants.delete(receiptId, participant.id);
            setParticipants((p) => p.filter((x) => x.id !== participant.id));
          } catch (e) {
            Alert.alert('Could not remove', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <Header title="People" />
      {loading ? (
        <ActivityIndicator className="mt-6" />
      ) : (
        <ScrollView contentContainerClassName="gap-3 pb-8" keyboardShouldPersistTaps="handled">
          {participants.length === 0 ? <Muted>No people yet.</Muted> : null}

          {participants.map((p) => (
            <Card key={p.id}>
              <View className="flex-row items-center gap-3">
                <TextInput
                  defaultValue={p.displayName}
                  onEndEditing={(e) => rename(p, e.nativeEvent.text)}
                  className="flex-1 text-base text-foreground"
                  autoCapitalize="words"
                />
                <Pressable onPress={() => confirmRemove(p)} hitSlop={8}>
                  <Trash2 color="#dc2626" size={20} />
                </Pressable>
              </View>
            </Card>
          ))}

          <View className="mt-2 flex-row items-center gap-2">
            <TextInput
              className="flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-base"
              placeholder="Add a person"
              placeholderTextColor="#9ca3af"
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={add}
              autoCapitalize="words"
              returnKeyType="done"
            />
            <Pressable onPress={add} className="rounded-xl bg-black px-4 py-2.5 active:bg-gray-800">
              <Text className="font-semibold text-white">Add</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
