'use strict';

/*
 * 推し活カレンダー Service Worker
 * オフラインキャッシュ用の最小限実装。
 * - install: index.html と自身をキャッシュ(cache-first)
 * - activate: 古いバージョンのキャッシュを破棄
 * - fetch: GETリクエストのみキャッシュ優先で処理し、ネットワークにフォールバックする
 * - バージョン文字列(CACHE_VERSION)を上げることでキャッシュを更新できる
 */

const CACHE_VERSION = 'v12';
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

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseClone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseClone))
            .catch((err) => {
              console.error('[sw] キャッシュの更新に失敗しました', err);
            });
          return response;
        })
        .catch((err) => {
          console.error('[sw] ネットワーク取得に失敗しました(オフラインの可能性)', err);
          throw err;
        });
    })
  );
});
