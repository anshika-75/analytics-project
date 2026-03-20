// reporting/index.js
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../dashboard')));
const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const dbName = 'analytics_db';

let client;
let db;
let shuttingDown = false;

async function connectMongo() {
  client = new MongoClient(mongoUrl);
  await client.connect();
  db = client.db(dbName);
  console.log('Reporting connected to MongoDB');
}

// connect at startup
connectMongo().catch(err => {
  console.error('[reporting] Mongo connect error', err);
  process.exit(1);
});

app.get('/stats', async (req, res) => {
  const site_id = req.query.site_id;
  const date = req.query.date; // optional, YYYY-MM-DD

  if (!site_id) return res.status(400).json({ error: 'site_id required' });

  try {
    const aggColl = db.collection('daily_aggregates');
    const q = { site_id };
    if (date) q.date = date;

    const docs = await aggColl.find(q).toArray();
    if (docs.length === 0) return res.status(404).json({ error: 'no data' });

    const totalViews = docs.reduce((s,d)=>s+(d.total_views||0),0);
    const uniqueUsers = docs.reduce((s,d)=> s + (d.unique_users || 0), 0); // already stored
    const pathCounts = {};
    docs.forEach(d=>{
      const p = d.paths || {};
      Object.entries(p).forEach(([path,c])=>{
        pathCounts[path] = (pathCounts[path]||0) + c;
      });
    });
    const top_paths = Object.entries(pathCounts)
                          .sort((a,b)=>b[1]-a[1])
                          .slice(0,10)
                          .map(([path,views])=>({ path, views }));

    res.json({
      site_id,
      date: date || 'all',
      total_views: totalViews,
      unique_users: uniqueUsers,
      top_paths
    });

  } catch(err) {
    console.error('[reporting] Error in /stats', err);
    res.status(500).json({ error: 'internal' });
  }
});

app.get('/health', (req, res) => {
  const mongoUp = !!db;
  res.json({ status: 'ok', mongo: mongoUp });
});

const port = process.env.PORT || 3001;
const server = app.listen(port, ()=>console.log(`Reporting API listening on ${port}`));

// ------- Graceful shutdown -------
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[reporting] Received ${signal}. Shutting down...`);

  try {
    server.close(err => {
      if (err) console.error('[reporting] Error closing server:', err);
      else console.log('[reporting] HTTP server closed.');
    });

    if (client) {
      try {
        await client.close();
        console.log('[reporting] MongoDB client closed.');
      } catch (cerr) {
        console.warn('[reporting] Error closing Mongo client:', cerr);
      }
    }

    setTimeout(() => {
      console.log('[reporting] Exiting process.');
      process.exit(0);
    }, 500);
  } catch (err) {
    console.error('[reporting] Shutdown error:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[reporting] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[reporting] Uncaught Exception:', err);
  shutdown('uncaughtException');
});
