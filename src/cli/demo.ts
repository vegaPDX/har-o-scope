/**
 * Embedded demo HAR for --demo flag.
 * Designed to trigger multiple rules for a representative output.
 */
import type { Har, Entry } from 'har-format'

const BASE_TIME = '2024-06-15T10:00:00.000Z'

function entry(offset: number, overrides: Partial<Entry> & {
  url?: string; status?: number; method?: string; mimeType?: string
  wait?: number; blocked?: number; dns?: number; connect?: number; ssl?: number
  bodySize?: number; httpVersion?: string
  headers?: Array<{ name: string; value: string }>
}): Entry {
  const {
    url = 'https://demo.example.com/api/data',
    status = 200, method = 'GET', mimeType = 'application/json',
    wait = 80, blocked = 2, dns = 0, connect = 0, ssl = 0,
    bodySize = 1200, httpVersion = 'h2',
    headers = [],
  } = overrides

  const time = new Date(new Date(BASE_TIME).getTime() + offset)

  return {
    startedDateTime: time.toISOString(),
    time: blocked + dns + connect + ssl + 1 + wait + 10,
    request: {
      method, url, httpVersion,
      headers: [],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: -1,
    },
    response: {
      status, statusText: status < 400 ? 'OK' : 'Error', httpVersion,
      headers: [
        { name: 'Content-Type', value: mimeType },
        ...headers,
      ],
      cookies: [],
      content: { size: bodySize, mimeType },
      redirectURL: '',
      headersSize: -1,
      bodySize,
    },
    cache: {},
    timings: { blocked, dns, connect, ssl, send: 1, wait, receive: 10 },
  } as Entry
}

export const demoHar: Har = {
  log: {
    version: '1.2',
    creator: { name: 'har-o-scope-demo', version: '1.0.0' },
    entries: [
      // Document load
      entry(0, { url: 'https://demo.example.com/', mimeType: 'text/html', wait: 250, dns: 25, connect: 40, ssl: 35, bodySize: 15000 }),

      // CSS + JS (normal)
      entry(350, { url: 'https://demo.example.com/assets/main.css', mimeType: 'text/css', bodySize: 8000 }),
      entry(360, { url: 'https://demo.example.com/assets/app.js', mimeType: 'application/javascript', bodySize: 95000 }),
      entry(370, { url: 'https://demo.example.com/assets/vendor.js', mimeType: 'application/javascript', bodySize: 280000 }),

      // API calls: 3 with slow TTFB (triggers slow-ttfb)
      entry(500, { url: 'https://demo.example.com/api/users', wait: 1200 }),
      entry(520, { url: 'https://demo.example.com/api/orders', wait: 2400 }),
      entry(540, { url: 'https://demo.example.com/api/dashboard/stats', wait: 950, bodySize: 4500 }),

      // Server errors (triggers broken-resources)
      entry(800, { url: 'https://demo.example.com/api/reports/generate', status: 500, wait: 3100 }),
      entry(1200, { url: 'https://demo.example.com/api/notifications', status: 503, wait: 30000 }),

      // Large payload (triggers large-payload)
      entry(600, { url: 'https://demo.example.com/api/export/full', wait: 450, bodySize: 2_500_000 }),

      // HTTP/1.1 third-party (triggers http1-downgrade)
      entry(400, { url: 'https://analytics.third-party.com/collect', httpVersion: 'HTTP/1.1', bodySize: 200 }),
      entry(410, { url: 'https://analytics.third-party.com/track', httpVersion: 'HTTP/1.1', bodySize: 150 }),

      // Normal images
      entry(450, { url: 'https://demo.example.com/images/logo.svg', mimeType: 'image/svg+xml', bodySize: 3000 }),
      entry(460, { url: 'https://demo.example.com/images/hero.webp', mimeType: 'image/webp', bodySize: 45000 }),

      // Font
      entry(380, { url: 'https://demo.example.com/fonts/inter.woff2', mimeType: 'font/woff2', bodySize: 24000 }),
    ],
  },
}
