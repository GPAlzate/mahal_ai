'use client';

import { api } from '@/lib/client/api-client';
import { useState, useEffect } from 'react';

interface Assignment {
  receiptLineId: number;
  participantId: number;
  shareQuantity: number;
}

export function useAssignments(receiptId: number, lineId: number) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const data = await api.assignments.list(receiptId, lineId);
      setAssignments(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [receiptId, lineId]);

  const assignParticipant = async (participantId: number, shareQuantity: number) => {
    try {
      const assignment = await api.assignments.assign(
        receiptId,
        lineId,
        participantId,
        shareQuantity
      );

      // Update local state optimistically
      setAssignments((prev) => {
        const existing = prev.find((a) => a.participantId === participantId);
        if (existing) {
          return prev.map((a) =>
            a.participantId === participantId ? { ...a, shareQuantity } : a
          );
        }
        return [...prev, assignment];
      });

      return assignment;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const unassignParticipant = async (participantId: number) => {
    try {
      await api.assignments.unassign(receiptId, lineId, participantId);
      setAssignments((prev) => prev.filter((a) => a.participantId !== participantId));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const getShareQuantity = (participantId: number): number => {
    const assignment = assignments.find((a) => a.participantId === participantId);
    return assignment?.shareQuantity || 0;
  };

  return {
    assignments,
    loading,
    error,
    assignParticipant,
    unassignParticipant,
    getShareQuantity,
    refetch: fetchAssignments,
  };
}
