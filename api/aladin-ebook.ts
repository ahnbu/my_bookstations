import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidIsbn13, lookupAladinEbook } from '../lib/aladinEbook';

export const config = { maxDuration: 15 };

// Resolve the Aladin ebook product link for a paper-book ISBN by reading the
// "전자책" tab on the Aladin product page. Called once when a book is added.
export default async function (request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    return response.status(405).send('Method Not Allowed');
  }
  const isbn = String(request.query.isbn || '');
  if (!isValidIsbn13(isbn)) {
    return response.status(400).json({ status: 'failed', reason: 'invalid-isbn' });
  }
  const result = await lookupAladinEbook(isbn);
  return response.status(200).json(result);
}
