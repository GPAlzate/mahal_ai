import { useUser } from '@clerk/clerk-expo';
import { api } from '@mahal/shared/client/api-client';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { Muted, Screen, ScreenTitle } from '@/components/ui';

export default function HomeScreen() {
  const { user } = useUser();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const name = user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? 'there';

  async function processAsset(asset: ImagePicker.ImagePickerAsset) {
    try {
      setBusy('Uploading…');
      const { url } = await api.receipts.uploadImage({
        uri: asset.uri,
        name: asset.fileName ?? `receipt-${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      });

      setBusy('Creating receipt…');
      const { receiptId } = await api.receipts.create({ status: 'ULIP' });

      setBusy('Reading receipt…');
      await api.receipts.triggerParse(receiptId, url);

      // The receipt now parses in the background (status PRSP). Show it in the list.
      router.push('/receipts');
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function capture(source: 'camera' | 'library') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', `Please allow ${source} access to add a receipt.`);
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });

    if (!result.canceled && result.assets[0]) {
      await processAsset(result.assets[0]);
    }
  }

  function onSnapPress() {
    Alert.alert('Add a receipt', undefined, [
      { text: 'Take photo', onPress: () => capture('camera') },
      { text: 'Choose from library', onPress: () => capture('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <Screen>
      <ScreenTitle>Mahal</ScreenTitle>
      <Muted>Hi {name} 👋</Muted>

      <View className="mt-8 items-center">
        <Pressable
          onPress={onSnapPress}
          disabled={busy !== null}
          className="h-40 w-full items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 active:bg-gray-50"
        >
          {busy ? (
            <>
              <ActivityIndicator />
              <Text className="mt-3 text-base font-medium text-gray-500">{busy}</Text>
            </>
          ) : (
            <>
              <Camera color="#9ca3af" size={32} />
              <Text className="mt-3 text-base font-medium text-gray-500">Snap a receipt</Text>
            </>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}
