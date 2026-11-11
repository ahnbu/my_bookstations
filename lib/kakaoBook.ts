// Kakao (Daum) book search → the app's existing AladdinBookItem shape.
// The app keeps the Aladin-shaped book_data so stores, zod validation and saved rows stay unchanged.
// Keep this file free of imports and TS-only syntax: node --test imports it directly.

const KAKAO_BOOK_URL = 'https://dapi.kakao.com/v3/search/book';
// Same value as aladinPaperUrl() in lib/aladinEbook.ts (kept import-free on purpose; a test checks they match).
const ALADIN_PAPER_BASE = 'https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=';

export type KakaoBookDoc = {
  title?: string;
  contents?: string;
  url?: string;
  isbn?: string;
  datetime?: string;
  authors?: string[];
  publisher?: string;
  translators?: string[];
  price?: number;
  sale_price?: number;
  thumbnail?: string;
  status?: string;
};

export type AladdinShapedItem = {
  title: string;
  author: string;
  pubDate: string;
  description: string;
  isbn13: string;
  cover: string;
  priceStandard: number;
  priceSales: number;
  publisher: string;
  link: string;
  subInfo: Record<string, unknown>;
  mallType: 'BOOK';
};

export function isbn10to13(isbn10: string): string | null {
  if (!/^\d{9}[\dXx]$/.test(isbn10)) return null;
  const core = '978' + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return core + String(check);
}

export function pickIsbn13(isbnField: string | undefined): string | null {
  const tokens = (isbnField || '').split(/\s+/).map(t => t.trim()).filter(Boolean);
  const thirteen = tokens.find(t => /^\d{13}$/.test(t));
  if (thirteen) return thirteen;
  const ten = tokens.find(t => /^\d{9}[\dXx]$/.test(t));
  return ten ? isbn10to13(ten) : null;
}

// Kakao thumbnails are 120x174; the fname query holds the original (~458px) image URL.
export function kakaoCoverUrl(thumbnail: string | undefined): string {
  if (!thumbnail) return '';
  try {
    const fname = new URL(thumbnail).searchParams.get('fname');
    if (fname) return fname.replace(/^http:\/\//, 'https://');
  } catch {
    // fall through to the thumbnail itself
  }
  return thumbnail;
}

export function kakaoDocToAladdinItem(doc: KakaoBookDoc): AladdinShapedItem | null {
  const isbn13 = pickIsbn13(doc.isbn);
  if (!isbn13) return null;
  const priceStandard = typeof doc.price === 'number' && doc.price >= 0 ? doc.price : 0;
  const priceSales = typeof doc.sale_price === 'number' && doc.sale_price >= 0 ? doc.sale_price : priceStandard;
  return {
    title: doc.title || '',
    author: (doc.authors || []).join(', '),
    pubDate: doc.datetime ? doc.datetime.slice(0, 10) : '',
    description: doc.contents || '',
    isbn13,
    cover: kakaoCoverUrl(doc.thumbnail),
    priceStandard,
    priceSales,
    publisher: doc.publisher || '',
    link: ALADIN_PAPER_BASE + isbn13,
    subInfo: {},
    mallType: 'BOOK',
  };
}

export function toKakaoTarget(searchType: string | undefined): string | null {
  switch (searchType) {
    case 'Title': return 'title';
    case 'Author': return 'person';
    case 'Publisher': return 'publisher';
    case 'ISBN': return 'isbn';
    default: return null; // Keyword and the retired 'eBook' type search everything
  }
}

export type CatalogSearchParams = {
  query: string;
  searchType?: string;
  maxResults?: number;
  page?: number;
};

export type CatalogSearchResult =
  | { ok: true; status: number; body: { item: AladdinShapedItem[] } }
  | { ok: false; status: number; body: { errorCode: number; errorMessage: string } };

/** Call Kakao book search and convert the result (server side). */
export async function searchKakaoCatalog(apiKey: string, params: CatalogSearchParams): Promise<CatalogSearchResult> {
  if (!apiKey) {
    return { ok: false, status: 500, body: { errorCode: 500, errorMessage: 'KAKAO_REST_API_KEY is missing' } };
  }
  const query = (params.query || '').trim();
  if (!query) return { ok: true, status: 200, body: { item: [] } };

  const size = Math.min(Math.max(Number(params.maxResults) || 20, 1), 50);
  const page = Math.min(Math.max(Number(params.page) || 1, 1), 50);
  const search = new URLSearchParams({ query, size: String(size), page: String(page) });
  const target = toKakaoTarget(params.searchType);
  if (target) search.set('target', target);

  const res = await fetch(`${KAKAO_BOOK_URL}?${search.toString()}`, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      body: { errorCode: res.status, errorMessage: (data && (data.message || data.errorType)) || `Kakao API error ${res.status}` },
    };
  }
  const docs: KakaoBookDoc[] = Array.isArray(data.documents) ? data.documents : [];
  const item = docs.map(kakaoDocToAladdinItem).filter((x): x is AladdinShapedItem => x !== null);
  return { ok: true, status: 200, body: { item } };
}
