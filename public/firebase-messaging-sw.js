importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCLuSb4QYE966wGT-T7LItN4xqy3J2GoGk',
  authDomain: 'stockdrop-d84ce.firebaseapp.com',
  projectId: 'stockdrop-d84ce',
  storageBucket: 'stockdrop-d84ce.firebasestorage.app',
  messagingSenderId: '769925568088',
  appId: '1:769925568088:web:e73e7c18708c0c31de5c2d',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  self.registration.showNotification(
    payload.notification?.title ?? 'STOCKDROP',
    { body: payload.notification?.body ?? '' }
  );
});
