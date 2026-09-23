const OFFLINE_CACHE = 'aurora-offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('aurora-offline-') && key !== OFFLINE_CACHE).map((key) => caches.delete(key)),
      )),
      self.clients.claim(),
    ]),
  )
})

// Authenticated pages, API responses, account balances and Next.js assets are
// never written to Cache Storage. Only a static offline explanation is cached.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(OFFLINE_CACHE)
      return (await cache.match(OFFLINE_URL)) ?? Response.error()
    }),
  )
})
