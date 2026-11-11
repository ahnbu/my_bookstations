// Aladin web page helpers (no API key needed).
// Aladin OpenAPI was shut down on 2026-10-30, so store links are built from ISBN
// and the ebook product link is read from the paper-book product page.
// Keep this file free of imports and TS-only syntax: node --test imports it directly.

const ALADIN_BASE = 'https://www.aladin.co.kr';

export function aladinPaperUrl(isbn13: string): string {
  return `${ALADIN_BASE}/shop/wproduct.aspx?ISBN=${isbn13}`;
}

export function aladinItemUrl(itemId: number | string): string {
  return `${ALADIN_BASE}/shop/wproduct.aspx?ItemId=${itemId}`;
}

export function aladinEbookSearchUrl(title: string): string {
  return `${ALADIN_BASE}/search/wsearchresult.aspx?SearchTarget=eBook&SearchWord=${encodeURIComponent(cleanSearchTitle(title))}`;
}

export function aladinIsbnSearchUrl(isbn13: string): string {
  return `${ALADIN_BASE}/search/wsearchresult.aspx?SearchTarget=Book&SearchWord=${isbn13}`;
}

// Drop subtitles / bracket tags so the ebook search matches more reliably.
function cleanSearchTitle(title: string): string {
  return (title || '')
    .replace(/^\[[^\]]*\]\s*/, '')
    .split(' - ')[0]
    .replace(/\([^)]*\)/g, '')
    .trim();
}

export type AladinPaperPage = {
  paperFound: boolean;
  ebook: { itemId: number; link: string } | null;
};

/**
 * Parse an Aladin paper-book product page (wproduct.aspx?ISBN=...).
 * - paperFound: the page is a real product page (title ends with " | 알라딘").
 *   An unknown ISBN returns a page titled just "알라딘".
 * - ebook: the "전자책" tab link inside the book_tab_box block, if any.
 */
export function parseAladinPaperPage(html: string): AladinPaperPage {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html || '');
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
  const paperFound = /\|\s*알라딘$/.test(title);

  let ebook: AladinPaperPage['ebook'] = null;
  const boxStart = (html || '').indexOf('book_tab_box');
  if (paperFound && boxStart !== -1) {
    const box = html.slice(boxStart, boxStart + 2000);
    const linkRe = /<a[^>]*href="([^"]*ItemId=(\d+)[^"]*)"[^>]*>\s*([^<]*)/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(box)) !== null) {
      if (m[3].trim().startsWith('전자책')) {
        const itemId = Number(m[2]);
        ebook = { itemId, link: aladinItemUrl(itemId) };
        break;
      }
    }
  }
  return { paperFound, ebook };
}

export type EbookLookupResult =
  | { status: 'found'; itemId: number; link: string; paperFound: true }
  | { status: 'none'; paperFound: boolean }
  | { status: 'failed'; reason: string };

export function isValidIsbn13(isbn: string): boolean {
  return /^\d{13}$/.test(isbn || '');
}

/**
 * Fetch the Aladin paper page and resolve the ebook link (server side).
 * Aladin sometimes stalls a single request while the next one answers in ~1s,
 * so try twice with a short timeout instead of waiting once for long
 * (2 × 6.5s stays inside the 15s Vercel function limit).
 */
export async function lookupAladinEbook(isbn13: string, timeoutMs = 6500, attempts = 2): Promise<EbookLookupResult> {
  let last: EbookLookupResult = { status: 'failed', reason: 'not-tried' };
  for (let i = 0; i < attempts; i++) {
    last = await lookupOnce(isbn13, timeoutMs);
    if (last.status !== 'failed') return last;
  }
  return last;
}

async function lookupOnce(isbn13: string, timeoutMs: number): Promise<EbookLookupResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(aladinPaperUrl(isbn13), { signal: controller.signal });
    if (!res.ok) return { status: 'failed', reason: `http-${res.status}` };
    const html = await res.text();
    const parsed = parseAladinPaperPage(html);
    if (parsed.ebook) {
      return { status: 'found', itemId: parsed.ebook.itemId, link: parsed.ebook.link, paperFound: true };
    }
    return { status: 'none', paperFound: parsed.paperFound };
  } catch (err) {
    const reason = err instanceof Error && err.name === 'AbortError' ? 'timeout' : (err instanceof Error ? err.message : 'unknown');
    return { status: 'failed', reason };
  } finally {
    clearTimeout(timer);
  }
}
