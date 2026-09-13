import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));

// A simple proxy endpoint to bypass CORS
app.post('/api/proxy/openai', async (req, res) => {
  try {
    const { targetUrl, headers, body } = req.body;
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing targetUrl parameter' });
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
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });
    
    const data = await response.text();
    res.status(response.status).send(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Proxy request failed' });
  }
});

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
