import { defineConfig } from 'waku/config';
import { fumadocsMdx } from 'fumadocs-mdx/vite';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

function requestLoggerPlugin(): Plugin {
  return {
    name: 'vite-request-logger',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const start = Date.now();
        const url = req.url || '/';

        // Ignore internal Vite sourcemap queries, hot updates, and asset noise
        const isInternalNoise =
          url.includes('/@') ||
          url.includes('/node_modules/') ||
          url.includes('.vite/') ||
          url.includes('__vite_rsc_findSourceMapURL') ||
          url.includes('/virtual:');

        if (!isInternalNoise) {
          console.log(`\x1b[36m[Waku/Vite]\x1b[0m \x1b[32m--> ${req.method}\x1b[0m ${url}`);

          res.on('finish', () => {
            const duration = Date.now() - start;
            const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
            console.log(
              `\x1b[36m[Waku/Vite]\x1b[0m ${statusColor}<-- ${req.method} ${url} ${res.statusCode}\x1b[0m \x1b[90m(${duration}ms)\x1b[0m`
            );
          });
        }
        next();
      });
    },
  };
}

export default defineConfig({
  vite: {
    resolve: {
      tsconfigPaths: true,
      dedupe: ['waku'],
    },
    plugins: [requestLoggerPlugin(), tailwindcss(), fumadocsMdx()],
  },
});
