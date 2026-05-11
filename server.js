import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { router as contactRouter }  from './routes/contact.js';
import { router as checkoutRouter } from './routes/checkout.js';
import { router as webhookRouter }  from './webhooks/stripe.js';
import { logger } from './lib/logger.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security headers ────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://progressivedigitalco.com')
  .split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    logger.warn({ origin }, 'CORS rejected');
    cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Idempotency-Key', 'X-Request-ID'],
}));

// ── STRIPE WEBHOOK — must be raw body, registered BEFORE express.json() ────
// Stripe signs requests with HMAC; parsing JSON first breaks verification.
app.use(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  webhookRouter
);

// ── Body parsing (all other routes) ────────────────────────────────────────
app.use(express.json({ limit: '16kb' }));

// ── Request logging ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      method: req.method, path: req.path,
      status: res.statusCode, ms: Date.now() - start,
    }, 'request');
  });
  next();
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

app.use('/api/contact',  contactRouter);
app.use('/api/checkout', checkoutRouter);

// ── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () =>
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'Server started')
);

export default app;
