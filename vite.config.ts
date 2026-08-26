import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const proxyPlugin = () => ({
  name: 'api-proxy',
  configureServer(server: any) {
    server.middlewares.use('/api/proxy/openai', async (req: any, res: any, next: any) => {
      if (req.method !== 'POST') return next();
      let body = '';
      req.on('data', (chunk: any) => body += chunk);
      req.on('end', async () => {
        try {
          const parsedBody = JSON.parse(body);
          const { targetUrl, headers, body: actualBody } = parsedBody;
          if (!targetUrl) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing targetUrl' }));
            return;
          }
          const forwardHeaders: Record<string, string> = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          };
          if (headers && typeof headers === 'object') {
            for (const [k, v] of Object.entries(headers)) {
              if (typeof v === 'string' && k.toLowerCase() !== 'host') {
                forwardHeaders[k] = v;
              }
            }
          }
          const response = await fetch(targetUrl, {
            method: 'POST',
            headers: forwardHeaders,
            body: typeof actualBody === 'string' ? actualBody : JSON.stringify(actualBody)
          });
          const data = await response.text();
          res.statusCode = response.status;
          res.end(data);
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message || 'Proxy request failed' }));
        }
      });
    });
  }
});

export default defineConfig(() => {
  // Automatically detect if we are building in GitHub Actions and set the base path to the repository name
  const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
  const repoName = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : '';
  const base = isGitHubActions && repoName ? `/${repoName}/` : './';

  return {
    base,
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''),
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''),
    },
    plugins: [react(), tailwindcss(), proxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
