import { type ReactNode } from 'react';
import { Text, View } from 'react-native';
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

/** Rounded surface card. */
export function Card({ children }: { children: ReactNode }) {
  return <View className="rounded-2xl border border-gray-200 bg-white p-4">{children}</View>;
}

/** Muted secondary text. */
export function Muted({ children }: { children: ReactNode }) {
  return <Text className="text-base text-black/50">{children}</Text>;
}
