export type ToolHandler = (args: any) => Promise<{ content: string; error?: string }>;

export const builtInHandlers: Record<string, ToolHandler> = {
  web_search: async (args: { query: string }) => {
    // DDG's html endpoint returns a 202 challenge page unless we POST with
    // proper browser-like headers (Referer in particular).
    const decodeHtml = (s: string) =>
      s
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const unwrapDdgRedirect = (href: string): string => {
      // DDG sometimes wraps outbound links as /l/?uddg=<encoded>
      const m = href.match(/[?&]uddg=([^&]+)/);
      if (m) {
        try {
          return decodeURIComponent(m[1]);
        } catch {
          return href;
        }
      }
      if (href.startsWith('//')) return `https:${href}`;
      return href;
    };

    try {
      const res = await fetch('https://html.duckduckgo.com/html/', {
        method: 'POST',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          Referer: 'https://html.duckduckgo.com/',
        },
        body: new URLSearchParams({ q: args.query, kl: 'wt-wt' }).toString(),
      });

      if (!res.ok) {
        return { content: '', error: `Search HTTP ${res.status}` };
      }

      const html = await res.text();

      const results: Array<{ title: string; url: string; snippet: string }> = [];

      // Each result row: <a class="result__a" href="…">TITLE</a> … <a class="result__snippet" href="…">SNIPPET</a>
      const rowRegex =
        /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

      let match: RegExpExecArray | null;
      while ((match = rowRegex.exec(html)) !== null) {
        const url = unwrapDdgRedirect(match[1]);
        const title = decodeHtml(match[2]);
        const snippet = decodeHtml(match[3]);
        if (title && url) {
          results.push({ title, url, snippet });
          if (results.length >= 8) break;
        }
      }

      const content =
        results.length > 0
          ? results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n')
          : 'No results found.';
      return { content };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: '', error: `Search failed: ${msg}` };
    }
  },
  fetch_url: async (args: { url: string }) => {
    const MAX_CHARS = 8000;
    if (!args.url || typeof args.url !== 'string') {
      return { content: '', error: 'url argument is required' };
    }

    let parsed: URL;
    try {
      parsed = new URL(args.url);
    } catch {
      return { content: '', error: `Invalid URL: ${args.url}` };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { content: '', error: `Unsupported protocol: ${parsed.protocol}` };
    }
    // Block obvious SSRF targets on the local machine / private LAN
    const host = parsed.hostname;
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^169\.254\./.test(host)
    ) {
      return { content: '', error: `Refusing to fetch internal/private address: ${host}` };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(parsed.toString(), {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      if (!res.ok) {
        return { content: '', error: `HTTP ${res.status} fetching ${args.url}` };
      }

      const contentType = res.headers.get('content-type') || '';
      const raw = await res.text();

      let text = raw;
      if (contentType.includes('html') || /<html[\s>]/i.test(raw.slice(0, 500))) {
        // Strip script/style blocks, then tags, then collapse whitespace
        text = raw
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
          .replace(/<!--[\s\S]*?-->/g, ' ')
          .replace(/<\/?(br|p|div|li|h[1-6]|tr|section|article)[^>]*>/gi, '\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ')
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }

      const truncated = text.length > MAX_CHARS;
      if (truncated) text = text.slice(0, MAX_CHARS) + `\n\n[truncated — fetched ${raw.length} chars, showing first ${MAX_CHARS}]`;

      return { content: `URL: ${parsed.toString()}\n\n${text}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: '', error: `Fetch failed: ${msg}` };
    } finally {
      clearTimeout(timeout);
    }
  },
};
