// processor/worker.js  (improved: Redis sets for unique users + graceful shutdown)
const Redis = require('ioredis');
const { MongoClient } = require('mongodb');

const redis = new Redis();
const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const dbName = 'analytics_db';

let shuttingDown = false;

async function start() {
  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db(dbName);
  const eventsColl = db.collection('events');
  const aggColl = db.collection('daily_aggregates');

  console.log('Worker connected to MongoDB, waiting for events...');

  // graceful shutdown handler
  process.on('SIGINT', async () => {
    console.log('Worker shutting down...');
    shuttingDown = true;
    await redis.quit();
    await client.close();
    process.exit(0);
  });

  while (!shuttingDown) {
    try {
      const res = await redis.brpop('events_queue', 0); // blocks
      const raw = res[1];
      const event = JSON.parse(raw);

      // insert raw event (fire-and-forget ok but await for simplicity)
      await eventsColl.insertOne(event);

      const dateKey = (new Date(event.timestamp)).toISOString().slice(0,10); // YYYY-MM-DD
      const redisSetKey = `unique:${event.site_id}:${dateKey}`;

      // add user to redis set (if user_id is falsy we store 'anon:<ts>' to avoid nulls)
      const userId = event.user_id || `anon:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
      await redis.sadd(redisSetKey, userId);
      // set expiry for the set so redis doesn't hold forever (e.g., 90 days)
      await redis.expire(redisSetKey, 60 * 60 * 24 * 90);

      // increment views and per-path count in Mongo aggregate
      const aggFilter = { site_id: event.site_id, date: dateKey };
      await aggColl.updateOne(
        aggFilter,
        {
          $inc: { total_views: 1, [`paths.${event.path}`]: 1 },
          // we'll not store users array here
        },
        { upsert: true }
      );

      // update unique_count field in Mongo from Redis set cardinality
      const uniqCount = await redis.scard(redisSetKey);
      await aggColl.updateOne(aggFilter, { $set: { unique_users: uniqCount } });

    } catch (err) {
      console.error('Worker error', err);
      // small delay before retrying
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

start().catch(err=>{
  console.error('Fatal worker error', err);
  process.exit(1);
});
