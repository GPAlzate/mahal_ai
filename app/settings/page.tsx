'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { ArrowLeft, Loader2, Check } from 'lucide-react';
import { api } from '@/lib/client/api-client';

interface UserProfile {
  username: string | null;
  displayName: string | null;
  gcashNumber: string | null;
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const sectionLabelClass = "font-dm-mono text-[10px] uppercase font-bold tracking-widest text-[#4d4732] px-4 mb-1";
const rowClass = "flex items-center justify-between px-4 py-3 bg-white";
const rowLabelClass = "font-dm-mono text-xs font-bold uppercase tracking-widest text-black flex-shrink-0 w-28";
const rowInputClass = "flex-1 font-dm-mono text-sm bg-transparent border-b-2 border-[#d0c9b8] focus:border-black focus:outline-none text-black placeholder:text-[#c0b9a8] transition-colors";

export default function SettingsPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

  const [profile, setProfile] = useState<UserProfile>({ username: '', displayName: '', gcashNumber: '' });
  const [originalUsername, setOriginalUsername] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    if (!isSignedIn) {
      router.replace('/login');
      return;
    }

    fetch('/api/user')
      .then((r) => r.json())
      .then((data) => {
        setProfile({ username: data.username ?? '', displayName: data.displayName ?? '', gcashNumber: data.gcashNumber ?? '' });
        setOriginalUsername(data.username ?? null);
        if (data.gcashNumber) {
          setPhoneDisplay(formatPhoneWithSpaces(data.gcashNumber));
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load profile');
        setLoading(false);
      });
  }, [isLoaded, isSignedIn, router]);

  const formatPhoneWithSpaces = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.replace(/(\d{3})(\d{3})(\d+)/, '$1 $2 $3');
  };

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhoneDisplay(formatPhoneWithSpaces(digits));
    setProfile((p) => ({ ...p, gcashNumber: digits }));
    if (phoneError) {
      setPhoneError('');
    }
  };

  const handleUsernameInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setProfile((p) => ({ ...p, username: value }));

    if (usernameCheckTimer.current) {
      clearTimeout(usernameCheckTimer.current);
    }

    if (!value) {
      setUsernameStatus('idle');
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(value)) {
      setUsernameStatus('invalid');
      return;
    }

    if (value === originalUsername) {
      setUsernameStatus('available');
      return;
    }

    setUsernameStatus('checking');
    usernameCheckTimer.current = setTimeout(async () => {
      try {
        const { available } = await api.users.checkUsername(value);
        setUsernameStatus(available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const phone = profile.gcashNumber ?? '';
    if (phone && (!phone.startsWith('9') || phone.length !== 10)) {
      setPhoneError('Must start with 9 and be 10 digits');
      return;
    }

    if (usernameStatus === 'taken') {
      setError('Username already taken');
      return;
    }

    if (usernameStatus === 'invalid') {
      setError('Username must be 3–20 characters: lowercase letters, numbers, and underscores only');
      return;
    }

    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const body: Record<string, string | null> = {
        displayName: profile.displayName || null,
        gcashNumber: profile.gcashNumber || null,
      };

      const trimmedUsername = profile.username?.trim() || null;
      if (trimmedUsername !== originalUsername) {
        body.username = trimmedUsername;
      }

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      const updated = await res.json();
      setOriginalUsername(updated.username ?? null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const usernameHint = () => {
    if (!profile.username) {
      return null;
    }
    if (usernameStatus === 'checking') {
      return { text: 'Checking...', color: 'text-[#4d4732]' };
    }
    if (usernameStatus === 'available') {
      return { text: 'Available', color: 'text-green-700' };
    }
    if (usernameStatus === 'taken') {
      return { text: 'Already taken', color: 'text-red-600' };
    }
    if (usernameStatus === 'invalid') {
      return { text: '3–20 chars, letters/numbers/underscores', color: 'text-red-600' };
    }
    return null;
  };

  const hint = usernameHint();

  return (
    <div className="min-h-screen bg-[#fff9ef] p-4 pb-20">
      <div className="max-w-lg mx-auto">

        <div className="mb-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1 font-dm-mono text-xs font-bold uppercase tracking-widest text-[#4d4732] hover:text-black transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="font-dm-sans text-2xl font-black uppercase px-3 py-2 bg-black text-white inline-block -rotate-1">
            mahal ai &lt;3
          </h1>
        </div>

        <h2 className="font-dm-sans font-black text-2xl uppercase mb-4">Settings</h2>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1].map((s) => (
              <div key={s} className="flex flex-col gap-1">
                <div className="h-2.5 w-16 bg-[#e8e0d0] rounded animate-pulse mb-2 mx-4" />
                <div className="border-2 border-black rounded-xl overflow-hidden bg-white">
                  {[0, 1].map((r) => (
                    <div key={r} className={`${rowClass} ${r > 0 ? 'border-t-2 border-black' : ''}`}>
                      <div className="h-3 w-20 bg-[#f3f3f3] rounded animate-pulse" />
                      <div className="h-3 w-24 bg-[#f3f3f3] rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-3">

            <div className="flex flex-col gap-1">
              <p className={sectionLabelClass}>Profile</p>
              <div className="border-2 border-black rounded-xl overflow-hidden bg-white shadow-[2px_2px_0px_0px_#000]">
                <div className={rowClass}>
                  <span className={rowLabelClass}>Username</span>
                  <div className="flex-1 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <span className="font-dm-mono text-sm text-[#4d4732]">@</span>
                      <input
                        className={rowInputClass}
                        placeholder="your_handle"
                        value={profile.username ?? ''}
                        onChange={handleUsernameInput}
                        disabled={saving}
                        maxLength={20}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                    {hint && (
                      <p className={`font-dm-mono text-[10px] font-bold uppercase tracking-wider pl-4 ${hint.color}`}>
                        {hint.text}
                      </p>
                    )}
                  </div>
                </div>
                <div className={`${rowClass} border-t-2 border-black`}>
                  <span className={rowLabelClass}>Display Name</span>
                  <input
                    className={rowInputClass}
                    placeholder="e.g. Gabe"
                    value={profile.displayName ?? ''}
                    onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <p className={sectionLabelClass}>Payment</p>
              <div className="border-2 border-black rounded-xl overflow-hidden bg-white shadow-[2px_2px_0px_0px_#000]">
                <div className={`${rowClass} flex-col items-start gap-1`}>
                  <div className="flex items-center w-full">
                    <span className={rowLabelClass}>GCash</span>
                    <div className="flex-1 flex items-center justify-end gap-1">
                      <span className="font-dm-mono text-xs text-[#4d4732]">+63</span>
                      <input
                        className={rowInputClass}
                        placeholder="917 123 4567"
                        value={phoneDisplay}
                        onChange={handlePhoneInput}
                        inputMode="numeric"
                        disabled={saving}
                      />
                    </div>
                  </div>
                  {phoneError && (
                    <p className="font-dm-mono text-[10px] font-bold text-red-600 uppercase tracking-wider w-full">{phoneError}</p>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <p className="font-dm-mono text-xs font-bold text-red-600 uppercase tracking-wider px-1">{error}</p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || usernameStatus === 'checking'}
                className="h-10 px-5 border-[3px] border-black rounded-lg font-dm-mono font-bold text-sm uppercase bg-white text-black shadow-[3px_3px_0px_0px_#000] hover:bg-[#fff9ef] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving</>
                ) : saved ? (
                  <><Check className="w-3.5 h-3.5" /> Saved</>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
