'use client';

import React, { useState, useRef, useEffect } from 'react';

interface EditableFieldProps {
  value: string | number;
  type: 'text' | 'number';
  prefix?: string;
  onSave: (newValue: string | number) => void | Promise<void>;
  onCancel?: () => void;
  validate?: (value: any) => string | null;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function EditableField({
  value,
  type,
  prefix,
  onSave,
  onCancel,
  validate,
  placeholder,
  className = '',
  disabled = false,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(String(value));
  }, [value]);

  const handleStartEdit = () => {
    if (disabled) return;
    setIsEditing(true);
    setEditValue(String(value));
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(String(value));
    setError(null);
    onCancel?.();
  };

  const handleSave = async () => {
    const finalValue = type === 'number' ? parseFloat(editValue) : editValue;

    // Validation
    if (validate) {
      const validationError = validate(finalValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    // Basic type validation
    if (type === 'number' && isNaN(finalValue as number)) {
      setError('Must be a valid number');
      return;
    }

    if (type === 'text' && !editValue.trim()) {
      setError('Cannot be empty');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave(finalValue);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <button
        onClick={handleStartEdit}
        disabled={disabled}
        className={`
          group relative inline-flex items-center gap-1
          ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:text-gray-600'}
          ${className}
        `}
      >
        <span>
          {prefix}
          {value}
        </span>
        {!disabled && (
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs">
            ✎
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {prefix && <span className="font-mono">{prefix}</span>}
        <input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder={placeholder}
          disabled={saving}
          className={`
            border-2 border-black px-2 py-1
            font-mono text-sm
            focus:outline-none focus:ring-0
            ${saving ? 'opacity-50' : ''}
            ${error ? 'border-red-600' : ''}
          `}
          style={{ width: `${Math.max(editValue.length + 2, 8)}ch` }}
        />
        {saving && <span className="text-xs">Saving...</span>}
      </div>
      {error && (
        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
          {error}
        </span>
      )}
    </div>
  );
}
