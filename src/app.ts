import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import adminRouter from './routes/admin.route.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

app.use('/admin/ui', express.static(join(__dirname, 'public')));

app.get('/', (_req, res) => {
  res.json({ message: 'who-tech-course API' });
});

app.use('/admin', adminRouter);

export default app;
