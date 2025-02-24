self.addEventListener('install', event => {
    // Skip waiting and become active immediately
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    // Claim all clients
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
    // Use navigation preload if available
    if (event.preloadResponse) {
        event.waitUntil(
            event.preloadResponse.then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
        );
    }
});
