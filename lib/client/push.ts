/**
 * Web-only push notification helpers.
 *
 * Deliberately lives in lib/client (not packages/shared): everything here
 * touches browser-only APIs (ServiceWorker, PushManager, Notification) that
 * don't exist in React Native.
 */

export type PushSupport =
  | 'supported'
  // iOS Safari only exposes push to installed PWAs — user must Add to Home Screen first
  | 'needs-install'
  | 'unsupported';

export function getPushSupport(): PushSupport {
  if (typeof window === 'undefined') {
    return 'unsupported';
  }

  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
    return 'supported';
  }

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;

  if (isIos && !isStandalone && 'serviceWorker' in navigator) {
    return 'needs-install';
  }

  return 'unsupported';
}

export function getPermissionState(): NotificationPermission | null {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (getPushSupport() !== 'supported') {
    return null;
  }
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    return null;
  }
  return registration.pushManager.getSubscription();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

/**
 * Subscribe this device to push and register the subscription server-side.
 * Must be called from a user gesture (permission prompt requirement).
 *
 * @param participantId - Ties a guest device to their participant on one
 *   receipt. Signed-in users can omit it; their Clerk session identifies them.
 * @returns true on success
 */
export async function subscribeToPush(participantId?: number): Promise<boolean> {
  if (getPushSupport() !== 'supported') {
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return false;
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string
      ) as BufferSource,
    }));

  const response = await fetch('/api/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      participantId: participantId ?? null,
    }),
  });

  return response.ok;
}

/**
 * Unsubscribe this device and remove the subscription server-side.
 */
export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getExistingSubscription();
  if (!subscription) {
    return;
  }

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await fetch('/api/push/subscriptions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}
