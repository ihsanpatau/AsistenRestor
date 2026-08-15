// Service worker RestoranKu - cache ringan untuk app-shell (bukan cache data pesanan/menu realtime)
// PENTING: naikkan angka versi ini setiap kali file JS/CSS diupdate & di-deploy,
// supaya HP pelanggan/pemilik resto tidak "nyangkut" pakai file lama dari cache
// (ini penyebab bug seperti "xxx is not defined" padahal kode sudah diperbaiki).
const CACHE_NAME = "restoranku-shell-v2";
const SHELL_FILES = ["style.css", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

// Network-first untuk HTML & API (data selalu segar), cache-first untuk asset statis
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Jangan cache request ke Supabase / API pihak ketiga - selalu perlu data terbaru
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(req).then((r) => r || caches.match("dashboard.html"))
      )
    );
    return;
  }

  // Network-first juga untuk JS & CSS: selalu coba ambil versi terbaru dari
  // server dulu, baru fallback ke cache kalau offline/network gagal. Ini
  // mencegah HP terus memakai file lama (misalnya supabase.js versi lama
  // yang menyebabkan error "xxx is not defined") setelah ada update.
  if (req.destination === "script" || req.destination === "style") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Aset statis lain (ikon, gambar, dsb): cache-first tetap oke karena
  // jarang berubah.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
            return res;
          })
          .catch(() => cached)
    )
  );
});
