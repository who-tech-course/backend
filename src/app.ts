import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { adminAuth } from './shared/middleware/auth.js';
import workspaceRouter from './features/workspace/workspace.route.js';
import repoRouter from './features/repo/repo.route.js';
import syncRouter from './features/sync/sync.route.js';
import blogRouter from './features/blog/blog.route.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

app.use('/admin/ui', express.static(join(__dirname, 'public')));

app.get('/', (_req, res) => {
  res.json({ message: 'who-tech-course API' });
});

app.use('/admin', adminAuth);
app.use('/admin/workspace', workspaceRouter);
app.use('/admin/repos', repoRouter);
app.use('/admin', syncRouter);
app.use('/admin', blogRouter);

export default app;
