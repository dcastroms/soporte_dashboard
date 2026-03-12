// public/sw.js — Minimal Service Worker for Push Notifications
// Handles push events sent from useLiveEvents.sendPush()

self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = event.notification.data?.url;
    if (url) {
        event.waitUntil(
            clients.matchAll({ type: "window" }).then((clientList) => {
                for (const client of clientList) {
                    if (client.url === url && "focus" in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
        );
    }
});
