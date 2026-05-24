function Bone({ className }: { className?: string }) {
  return (
    <div
      className={`bg-[#e8e4db] rounded ${className ?? ''}`}
      style={{
        backgroundImage: 'linear-gradient(90deg, transparent 0%, oklch(0.95 0.005 80) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.6s ease-in-out infinite',
      }}
    />
  );
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#fff9ef]">
      <div className="max-w-lg mx-auto p-4 pb-20">

        <div className="mb-4 flex items-center justify-between">
          <Bone className="w-[140px] h-[40px] rounded-none" />
          <Bone className="w-10 h-10 rounded-full" />
        </div>

        <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_#000] rounded-xl p-5 flex flex-col gap-4">
          <Bone className="w-[140px] h-8" />
          <Bone className="w-full h-[180px] rounded-lg" />
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t-2 border-[#e8e4db]" />
            <Bone className="w-6 h-3" />
            <div className="flex-1 border-t-2 border-[#e8e4db]" />
          </div>
          <Bone className="w-full h-12 rounded-lg" />
          <Bone className="w-full h-12 rounded-lg" />
        </div>

        <div className="mt-4 bg-white border-[3px] border-black shadow-[3px_3px_0px_0px_#000] rounded-xl p-5 flex flex-col gap-3">
          <Bone className="w-[130px] h-7" />
          <div className="flex flex-col border-2 border-[#e8e4db] rounded-lg overflow-hidden">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t-2 border-[#e8e4db]' : ''}`}
              >
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Bone className="h-4 w-[60%]" />
                    <Bone className="h-4 w-12" />
                  </div>
                  <Bone className="h-3 w-[45%]" />
                </div>
                <Bone className="w-4 h-4 ml-3 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] rounded-xl p-4 flex flex-col gap-2">
          <Bone className="w-[120px] h-3" />
          <div className="flex gap-2">
            <Bone className="flex-1 h-11 rounded-lg" />
            <Bone className="w-11 h-11 rounded-lg" />
          </div>
        </div>

      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
