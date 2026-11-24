'use strict';

const crypto = require('node:crypto');
const { handleEvent } = require('./eventHandlers');

const _processedIds = new Set();

async function handleWebhook(req, res) {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;

  // The raw body is required so the signature is checked against the exact bytes received.
  if (
    typeof signature !== 'string' ||
    !/^sha256=[0-9a-f]{64}$/i.test(signature) ||
    typeof secret !== 'string' ||
    secret.length === 0 ||
    !Buffer.isBuffer(req.body)
  ) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const received = Buffer.from(signature.slice('sha256='.length), 'hex');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest();

  // timingSafeEqual throws when buffer lengths differ, so validate the length first.
  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(expected, received)
  ) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (_processedIds.has(event.id)) {
    return res.status(200).json({ status: 'already_processed' });
  }

  // Record the ID before scheduling work to prevent concurrent replays.
  _processedIds.add(event.id);

  // Acknowledge immediately; event processing happens asynchronously.
  res.status(200).json({ status: 'received' });

  setImmediate(() => {
    Promise.resolve(handleEvent(event)).catch((error) => {
      console.error('Webhook event processing failed:', error);
    });
  });
}

module.exports = { handleWebhook, _processedIds };
