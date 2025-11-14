'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { ParticipantPill } from '@/components/ParticipantPill';
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
  }, [receiptId]);

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
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-wider mb-4">
            Add Participants
          </h1>
          <p className="text-lg font-mono">
            Who&apos;s splitting this receipt? Add everyone now.
          </p>
        </div>

        {/* Add Participant Form */}
        <Card padding="lg" className="mb-6">
          <form onSubmit={handleAddParticipant}>
            <div className="flex gap-4">
              <Input
                placeholder="Enter name"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                fullWidth
              />
              <Button type="submit" disabled={!participantName.trim()}>
                Add
              </Button>
            </div>
          </form>
        </Card>

        {/* Participants List */}
        {participants.length > 0 ? (
          <Card padding="lg" className="mb-6">
            <h2 className="font-bold text-2xl uppercase tracking-wider mb-4">
              Participants ({participants.length})
            </h2>
            <div className="flex flex-wrap gap-3">
              {participants.map((participant) => (
                <ParticipantPill
                  key={participant.tempId}
                  name={participant.displayName}
                  onRemove={() => handleRemoveParticipant(participant.tempId)}
                />
              ))}
            </div>
          </Card>
        ) : (
          <Card padding="lg" className="mb-6">
            <p className="font-mono text-center">
              No participants yet. Add someone to get started!
            </p>
          </Card>
        )}

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