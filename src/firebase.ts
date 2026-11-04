import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const app = initializeApp({
  apiKey: 'AIzaSyCLuSb4QYE966wGT-T7LItN4xqy3J2GoGk',
  authDomain: 'stockdrop-d84ce.firebaseapp.com',
  projectId: 'stockdrop-d84ce',
  storageBucket: 'stockdrop-d84ce.firebasestorage.app',
  messagingSenderId: '769925568088',
  appId: '1:769925568088:web:e73e7c18708c0c31de5c2d',
});

export const messaging = getMessaging(app);

const VAPID = 'BGb2MhROouWwpbvzrcfJcA8-zzpXd46vTjohCV2FMY1QRqVVpwxZXpIYAChKiUH-Pp_CLSjJKnQ6KwxU9VlHwT4';

export async function requestPushPermission(): Promise<string | null> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const reg = await navigator.serviceWorker.ready;
  return getToken(messaging, { vapidKey: VAPID, serviceWorkerRegistration: reg });
}

export function onForegroundMessage(cb: (payload: any) => void) {
  return onMessage(messaging, cb);
}
