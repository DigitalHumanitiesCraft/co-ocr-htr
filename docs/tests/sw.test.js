/**
 * Service worker fetch strategy: a deploy must reach returning visitors, so
 * same-origin requests go to the network first and use the cache only offline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Vitest runs from docs/ (vitest.config.js); import.meta.url is not a file URL under jsdom
const SW_SOURCE = readFileSync(join(process.cwd(), 'sw.js'), 'utf8');

function loadWorker({ cached, network }) {
  const listeners = {};
  const cache = { put: vi.fn(), addAll: vi.fn() };
  const env = {
    self: {
      location: { origin: 'https://example.org' },
      addEventListener: (type, fn) => { listeners[type] = fn; },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() }
    },
    caches: {
      match: vi.fn(async () => cached),
      open: vi.fn(async () => cache),
      keys: vi.fn(async () => [])
    },
    fetch: vi.fn(network),
    Response: { error: () => 'network-error' }
  };
  new Function('self', 'caches', 'fetch', 'Response', 'console', SW_SOURCE)(
    env.self, env.caches, env.fetch, env.Response, { log() {}, error() {} }
  );
  return { listeners, env };
}

function fire(listeners, url) {
  let responded;
  listeners.fetch({
    request: { url, method: 'GET', headers: new Map([['accept', 'text/javascript']]) },
    respondWith: (promise) => { responded = promise; }
  });
  return responded;
}

describe('service worker fetch', () => {
  let fresh;

  beforeEach(() => {
    fresh = { status: 200, clone: () => 'clone', body: 'new' };
  });

  it('should serve the network response even when an older copy is cached', async () => {
    const { listeners } = loadWorker({ cached: { body: 'old' }, network: async () => fresh });
    expect(await fire(listeners, 'https://example.org/js/main.js')).toBe(fresh);
  });

  it('should fall back to the cache when the network fails', async () => {
    const old = { body: 'old' };
    const { listeners } = loadWorker({ cached: old, network: async () => { throw new TypeError('offline'); } });
    expect(await fire(listeners, 'https://example.org/js/main.js')).toBe(old);
  });
});
