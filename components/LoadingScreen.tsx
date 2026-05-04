interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-[#fff9ef] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black shadow-[4px_4px_0px_0px_#000] rounded-xl p-8 flex items-center gap-3">
        <div className="animate-spin h-5 w-5 border-2 border-black border-t-transparent rounded-full" />
        <p className="font-dm-mono font-bold uppercase tracking-wider text-sm">{message}</p>
      </div>
    </div>
  );
}
