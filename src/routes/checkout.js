import express from 'express';
import Stripe from 'stripe';
import { rateLimit } from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { saveEnrollment } from '../lib/db-enrollments.js';
import { logger } from '../lib/logger.js';

export const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-04-10',
});

const VALID_COURSE_IDS = [
  'pmp-prep', 'acp-prep', 'capm-prep', 'safe-sp',
  'safe-ssm', 'safe-sasm', 'safe-teams', 'safe-popm',
  'scrum-master', 'pm-leadership',
];

const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many checkout attempts. Please try again later.' },
});

router.post('/', checkoutLimiter, [
  body('priceId').trim().notEmpty().matches(/^price_[a-zA-Z0-9_]+$/),
  body('courseId').trim().notEmpty().isIn(VALID_COURSE_IDS),
  body('mode').isIn(['payment', 'subscription']),
], async (req, res) => {
  const log = logger.child({ route: 'POST /api/checkout' });
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { priceId, courseId, mode } = req.body;

  try {
    const origin = req.headers.origin || process.env.SITE_URL;
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/enrollment-success?session_id={CHECKOUT_SESSION_ID}&course=${courseId}`,
      cancel_url: `${origin}/#courses`,
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
      metadata: { courseId, mode, source: 'website' },
      ...(mode === 'subscription' && { subscription_data: { metadata: { courseId } } }),
    });
    log.info({ sessionId: session.id, courseId }, 'Checkout session created');
    return res.status(200).json({ sessionId: session.id });
  } catch (err) {
    log.error({ err }, 'Checkout error');
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});
