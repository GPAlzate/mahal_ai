'use client';

import React from 'react';
import { Card } from './Card';
import { Button } from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md">
        <Card padding="lg">
          <h2 className="text-2xl font-bold uppercase tracking-wider mb-4">
            {title}
          </h2>
          <p className="font-mono text-sm mb-6 whitespace-pre-line">
            {message}
          </p>
          <div className="flex gap-4">
            <Button
              variant="secondary"
              fullWidth
              onClick={onCancel}
            >
              {cancelText}
            </Button>
            <Button
              fullWidth
              onClick={onConfirm}
            >
              {confirmText}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
