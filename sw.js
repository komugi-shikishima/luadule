'use strict';

/*
 * 推し活カレンダー Service Worker
 * オフラインキャッシュ実装(v13からnetwork-first)。
 * - install: index.html / public.html と自身をキャッシュ
 * - activate: 古いバージョンのキャッシュを破棄
 * - fetch: まずネットワークから最新を取得して表示(+キャッシュ更新)。
 *          オフライン時のみキャッシュにフォールバックする。
 *          これにより「アップロードした更新が古いキャッシュに隠れる」問題を防ぐ
 */

const CACHE_VERSION = 'v36';
const CACHE_NAME = `oshical-cache-${CACHE_VERSION}`;
const PRECACHE_URLS = ['./', './index.html', './sw.js', './public.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => {
        console.error('[sw] プリキャッシュに失敗しました', err);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .catch((err) => {
        console.error('[sw] 古いキャッシュの削除に失敗しました', err);
      })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // network-first: 最新を取りに行き、成功したらキャッシュも更新。失敗(オフライン)時のみキャッシュを返す
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseClone))
            .catch((err) => {
              console.error('[sw] キャッシュの更新に失敗しました', err);
            });
        }
        return response;
      })
      .catch(() => {
        console.info('[sw] オフラインのためキャッシュから表示します');
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          throw new Error('オフラインでキャッシュもありません');
        });
      })
  );
});
