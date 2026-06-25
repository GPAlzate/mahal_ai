import { Text, View } from 'react-native';

// Mirrors the web ReceiptStatusBadge labels/colors (web uses oklch; these are
// close hex/Tailwind equivalents that react-native-css-interop supports).
function styleFor(status: string): { box: string; text: string; label: string } {
  switch (status) {
    case 'STLD':
      return { box: 'bg-green-200 border-black', text: 'text-black', label: 'Settled' };
    case 'FLZD':
      return { box: 'bg-indigo-200 border-black', text: 'text-black', label: 'Finalized' };
    case 'DRFT':
      return { box: 'bg-amber-200 border-black', text: 'text-black', label: 'Draft' };
    default:
      return { box: 'bg-gray-100 border-black', text: 'text-gray-500', label: 'Processing' };
  }
}

export function ReceiptStatusBadge({ status }: { status: string }) {
  const s = styleFor(status);
  return (
    <View className={`shrink-0 rounded border px-1.5 py-0.5 ${s.box}`}>
      <Text className={`text-[9px] font-bold uppercase tracking-widest ${s.text}`}>{s.label}</Text>
    </View>
  );
}
