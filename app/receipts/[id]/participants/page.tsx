'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { api } from '@/lib/client/api-client';

interface LocalParticipant {
  tempId: string;
  displayName: string;
}

/**
 * TODO: make ui like the CLEAR app
 */
export default function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const receiptId = parseInt(resolvedParams.id);
  const router = useRouter();

  const [participantName, setParticipantName] = useState('');
  const [participants, setParticipants] = useState<LocalParticipant[]>([]);
  const [linesReady, setLinesReady] = useState(false);
  const [checkingLines, setCheckingLines] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Check if receipt parsing is complete
  useEffect(() => {
    const checkReceiptStatus = async () => {
      try {
        const receipt = await api.receipts.get(receiptId);

        // Redirect to share code page if finalized
        if (receipt.status === 'FLZD') {
          setCheckingLines(false);
          router.push(`/${receipt.shareCode}`);
          return;
        }

        if (receipt.status === 'DRFT') {
          // Parsing complete, receipt is ready
          setLinesReady(true);
          setCheckingLines(false);
        } else if (receipt.status === 'DLTD') {
          // Parsing failed (marked as deleted)
          setError('Failed to parse receipt. Please try uploading again.');
          setCheckingLines(false);
        } else if (receipt.status === 'PRSP') {
          // Still parsing (status='PRSP'), check again in 2 seconds
          setTimeout(checkReceiptStatus, 3000);
        } else {
          // Unknown status, try again
          setTimeout(checkReceiptStatus, 3000);
        }
      } catch (err) {
        // Error fetching receipt, try again
        setTimeout(checkReceiptStatus, 3000);
      }
    };

    checkReceiptStatus();
  }, [receiptId, router]);

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();

    if (!participantName.trim()) return;

    // Add participant to local state only
    const newParticipant: LocalParticipant = {
      tempId: `temp-${Date.now()}`,
      displayName: participantName.trim(),
    };

    setParticipants((prev) => [...prev, newParticipant]);
    setParticipantName('');
  };

  const handleRemoveParticipant = (tempId: string) => {
    setParticipants((prev) => prev.filter((p) => p.tempId !== tempId));
  };

  const handleContinue = async () => {
    if (participants.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      // Batch create all participants with single API call
      await api.participants.create(receiptId, participants);

      // Navigate to assignment page
      router.push(`/receipts/${receiptId}/assign`);
    } catch (err: any) {
      setError(err.message || 'Failed to save participants');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-yellow-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1 text-sm font-mono uppercase tracking-wider text-gray-600 hover:text-black mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 p-4 bg-black text-white inline-block transform -rotate-1">
            mahal ai &lt;3
          </h1>
        </div>

        {/* Add Participant Form and List */}
        <Card padding="lg" className="mb-6">
          <h2 className="text-2xl font-bold mb-4">Who&apos;s splitting the bill?</h2>

          <form onSubmit={handleAddParticipant} className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                className="flex-1 p-3 border-4 border-black focus:outline-none focus:ring-0 focus:border-black"
                placeholder="Enter name"
              />
              <button
                type="submit"
                disabled={!participantName.trim()}
                className="p-4 border-4 border-black bg-green-300 hover:enabled:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </form>

          {/* Participants List */}
          <div className="space-y-2">
            {participants.map((participant) => (
              <div
                key={participant.tempId}
                className="flex items-center justify-between p-3 border-4 border-black bg-white"
              >
                <span className="font-bold">{participant.displayName}</span>
                <button
                  onClick={() => handleRemoveParticipant(participant.tempId)}
                  className="p-1 hover:text-red-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Error Message */}
        {error && (
          <Card padding="md" className="mb-6 border-red-600">
            <p className="font-bold uppercase tracking-wider text-red-600">{error}</p>
          </Card>
        )}

        {/* Continue Button */}
        <Button
          fullWidth
          size="lg"
          onClick={handleContinue}
          disabled={participants.length === 0 || !linesReady || saving}
        >
          {saving && 'Saving participants...'}
          {!saving && checkingLines && (
            <span className="flex items-center gap-2 justify-center">
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Parsing receipt...
            </span>
          )}
          {!saving && !checkingLines && participants.length === 0 && 'Add participants to continue'}
          {!saving && !checkingLines && participants.length > 0 && 'View Receipt →'}
        </Button>
      </div>
    </div>
  );
}