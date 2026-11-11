// vite.config.ts

import { fileURLToPath, URL } from 'url';
import { defineConfig, loadEnv, type ConfigEnv, type Plugin } from 'vite';
import { searchKakaoCatalog } from './lib/kakaoBook';
import { isValidIsbn13, lookupAladinEbook } from './lib/aladinEbook';

// Serve /api/search and /api/aladin-ebook in `vite dev` with the same lib code the
// Vercel functions (api/*.ts) use, so dev and production share one path.
function localApiPlugin(kakaoKey: string): Plugin {
  return {
    name: 'local-book-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(body));
        };
        try {
          if (url.pathname === '/api/search') {
            const q = url.searchParams;
            const result = await searchKakaoCatalog(kakaoKey, {
              query: q.get('Query') || '',
              searchType: q.get('QueryType') || 'Keyword',
              maxResults: Number(q.get('MaxResults')) || 20,
              page: Number(q.get('start')) || 1,
            });
            return send(result.status, result.body);
          }
          if (url.pathname === '/api/aladin-ebook') {
            const isbn = url.searchParams.get('isbn') || '';
            if (!isValidIsbn13(isbn)) return send(400, { status: 'failed', reason: 'invalid-isbn' });
            return send(200, await lookupAladinEbook(isbn));
          }
        } catch (error) {
          return send(500, { errorCode: 500, errorMessage: error instanceof Error ? error.message : 'local api error' });
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }: ConfigEnv) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
      plugins: [localApiPlugin(env.KAKAO_REST_API_KEY || '')],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // [핵심 수정] @가 프로젝트 루트('.')를 가리키도록 수정
          '@': fileURLToPath(new URL('.', import.meta.url))
        }
      },
      server: {
        hmr: {
          overlay: false,
        },
      },
    };
});
