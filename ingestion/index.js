// ingestion/index.js
const express = require('express');
const bodyParser = require('body-parser');
const Redis = require('ioredis');
const Joi = require('joi');

const app = express();
app.use(bodyParser.json());

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : new Redis();

const eventSchema = Joi.object({
  site_id: Joi.string().required(),
  event_type: Joi.string().required(),
  path: Joi.string().required(),
  user_id: Joi.string().allow(null, ''),
  timestamp: Joi.string().isoDate().required()
});

app.post('/event', async (req, res) => {
  const { error, value } = eventSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  try {
    // push to Redis list (fast)
    await redis.lpush('events_queue', JSON.stringify(value));
    // respond quickly — don't wait for DB writes
    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Redis push failed', err);
    return res.status(500).json({ error: 'internal' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', redis: redis.status }));

const port = process.env.PORT || 3000;
const server = app.listen(port, () => console.log(`Ingestion API listening on ${port}`));

// ------- Graceful shutdown -------
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[ingestion] Received ${signal}. Shutting down...`);

  try {
    // stop accepting new connections
    server.close(err => {
      if (err) {
        console.error('[ingestion] Error closing server:', err);
      } else {
        console.log('[ingestion] HTTP server closed.');
      }
    });

    // quit Redis connection
    try {
      await redis.quit();
      console.log('[ingestion] Redis connection closed.');
    } catch (rerr) {
      console.warn('[ingestion] Error closing Redis connection (force quit):', rerr);
      try { redis.disconnect(); } catch(_) {}
    }

    // give a small grace period for any inflight requests
    setTimeout(() => {
      console.log('[ingestion] Exiting process.');
      process.exit(0);
    }, 500);
  } catch (err) {
    console.error('[ingestion] Shutdown error:', err);
    process.exit(1);
  }
}

// handle signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// handle unexpected errors to make sure we try to close connections
process.on('unhandledRejection', (reason) => {
  console.error('[ingestion] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[ingestion] Uncaught Exception:', err);
  shutdown('uncaughtException');
});
