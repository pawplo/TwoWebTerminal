var cache_name = 'two-web-terminal-cache';
var files_to_cache = [
  '/',
  '/css/style.css',
  '/js/terminal.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(cache_name).then(function(cache) {
      return cache.addAll(files_to_cache);
    })
  );
});

self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request)
    .then(
      function(response) {
          return response || fetch(e.request);
      }
    )
  );
});