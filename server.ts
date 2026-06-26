/**
 * Local development entry point.
 * This file is only used locally (npm run dev / tsx server.ts).
 * On Vercel, api/index.ts → api/server.ts is used instead.
 */
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import app from './api/server';

const PORT = process.env.PORT || 3000;

async function startLocalServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const express = (await import('express')).default;
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startLocalServer();
export default app;
