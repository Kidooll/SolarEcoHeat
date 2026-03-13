self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames
                    .filter((cacheName) => cacheName === "apis" || cacheName.startsWith("apis-"))
                    .map((cacheName) => caches.delete(cacheName)),
            ),
        ),
    );
});
