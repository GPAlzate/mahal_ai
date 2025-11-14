'use client';

import { useState, useEffect } from 'react';
import { api } from '../api-client';

export function useParticipants(receiptId: number) {
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParticipants = async () => {
    try {
      setLoading(true);
      const data = await api.participants.list(receiptId);
      setParticipants(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipants();
  }, [receiptId]);

  const addParticipant = async (displayName: string) => {
    try {
      const newParticipant = await api.participants.create(receiptId, displayName);
      setParticipants((prev) => [...prev, newParticipant]);
      return newParticipant;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const removeParticipant = async (participantId: number) => {
    try {
      await api.participants.delete(receiptId, participantId);
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  return {
    participants,
    loading,
    error,
    addParticipant,
    removeParticipant,
    refetch: fetchParticipants,
  };
}
