import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-100">
      <main className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Receipt Splitter
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Split bills easily with friends. Upload a receipt, assign items, and see who owes what.
        </p>

        <Link
          href="/create/upload"
          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-4 rounded-lg text-lg transition-colors"
        >
          Create New Receipt Split
        </Link>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-4">
            <div className="text-3xl mb-2">📸</div>
            <h3 className="font-semibold text-gray-900 mb-1">Upload Receipt</h3>
            <p className="text-sm text-gray-600">Take a photo or upload an image</p>
          </div>
          <div className="p-4">
            <div className="text-3xl mb-2">✏️</div>
            <h3 className="font-semibold text-gray-900 mb-1">Assign Items</h3>
            <p className="text-sm text-gray-600">Choose who had what</p>
          </div>
          <div className="p-4">
            <div className="text-3xl mb-2">💰</div>
            <h3 className="font-semibold text-gray-900 mb-1">Split the Bill</h3>
            <p className="text-sm text-gray-600">See who owes what</p>
          </div>
        </div>
      </main>
    </div>
  );
}
