import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, type TextInputProps, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

/** Screen wrapper with safe-area padding and consistent horizontal gutters. */
export function Screen({
  children,
  edges = ['top'],
}: {
  children: ReactNode;
  edges?: Edge[];
}) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-white">
      <View className="flex-1 px-5">{children}</View>
    </SafeAreaView>
  );
}

/** Large screen title. */
export function ScreenTitle({ children }: { children: ReactNode }) {
  return <Text className="my-4 text-3xl font-bold text-foreground">{children}</Text>;
}

/** Top bar with a back button and a title, for pushed detail screens. */
export function Header({ title, right }: { title: string; right?: ReactNode }) {
  const router = useRouter();
  return (
    <View className="flex-row items-center justify-between py-3">
      <View className="flex-row items-center gap-1">
        <Pressable onPress={() => router.back()} hitSlop={8} className="-ml-1">
          <ChevronLeft color="#000" size={28} />
        </Pressable>
        <Text numberOfLines={1} className="text-xl font-bold text-foreground">
          {title}
        </Text>
      </View>
      {right ?? null}
    </View>
  );
}

/** Rounded surface card. */
export function Card({ children }: { children: ReactNode }) {
  return <View className="rounded-2xl border border-gray-200 bg-white p-4">{children}</View>;
}

/** Muted secondary text. */
export function Muted({ children }: { children: ReactNode }) {
  return <Text className="text-base text-black/50">{children}</Text>;
}

/** Labeled text field. */
export function Field({
  label,
  ...props
}: { label: string } & TextInputProps) {
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</Text>
      <TextInput
        className="rounded-xl border border-gray-300 px-4 py-3 text-base text-foreground"
        placeholderTextColor="#9ca3af"
        {...props}
      />
    </View>
  );
}

/** Primary action button. */
export function Button({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`h-14 flex-row items-center justify-center rounded-2xl ${
        disabled || loading ? 'bg-gray-300' : 'bg-black active:bg-gray-800'
      }`}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className="text-base font-semibold text-white">{label}</Text>
      )}
    </Pressable>
  );
}
