# 🚀 Real-Time Web Analytics Pipeline

Welcome to my custom-built, highly scalable web analytics pipeline! 

## 💡 Why I Built This (The Main Purpose)
If you own a popular website and want to track how many people visit your pages, you have a problem: **saving data directly to a database every time someone clicks a button will crash your website when traffic spikes.** Database writes are slow and block the main thread.

I built this project to solve that exact problem. This acts like a custom "Mini-Google Analytics." It uses an **event-driven microservices architecture** to catch traffic instantly, hold it safely in a high-speed memory queue, and process it in the background so the user's website experience is never slowed down. It then visualizes all that data on a sleek, real-time dashboard.

---

## 🏗️ How It Works (The Architecture)

This project is split into four distinct, decoupled pieces:

1. **The Ingestion API**: A fast Node.js/Express server that acts as a "catcher." It receives events from the website, instantly drops them into Redis, and replies "ok" so it never slows down the user.
2. **Redis (The Queue)**: Acts as a high-speed shock absorber. If traffic spikes 100x suddenly, Redis safely holds the queue of events in memory without crashing.
3. **The Processor Worker**: A background script that constantly pulls events off the Redis queue one by one. It permanently saves the raw data to MongoDB and uses advanced **Redis Sets** to efficiently calculate *Unique Users* without duplicates.
4. **The Reporting API & Dashboard UI**: The backend Reporting API pulls aggregated data from MongoDB, and the Vanilla HTML/JS Dashboard visualizes it with beautiful, interactive charts that update automatically.

---

## 🛠️ Tech Stack
- **Node.js (Express)** - Backend APIs and Worker
- **Redis** - High-speed message queue and Unique User sets
- **MongoDB** - Persistent data storage and daily aggregates
- **Chart.js** - Frontend data visualization
- **Vanilla HTML/CSS/JS** - Native glassmorphic Dashboard UI

---

## 💻 How to Run This Project Locally

**1. Start your databases**  
Make sure Redis and MongoDB are installed and running in the background. If you are on a Mac using Homebrew:
```bash
brew services start redis
brew services start mongodb-community@7.0
```

**2. Start the entire pipeline**  
Navigate to the root folder of the project in your terminal and run:
```bash
npm install
npm start
```
*Because of the `concurrently` package, this single command automatically launches the Ingestion API (port 4000), the Processor Worker, the Reporting API (port 4001), and the Dashboard UI (port 8080).*

**3. View the Dashboard**  
Open your browser and navigate to: **[http://localhost:8080](http://localhost:8080)**

---

## 🧪 Try it Out (Live Demo Scripts)

The best way to see the power of this architecture is to simulate website traffic and watch the Dashboard react in real-time. 

Leave your Dashboard open in your browser, open a new terminal window, and copy/paste these automated test scripts!

### Test 1: Simulate a sudden "Traffic Spike"
This script simulates 15 completely different users clicking the `/pricing` page extremely quickly. Watch your Dashboard's **Total Views** and **Unique Users** instantly surge!

```bash
node -e "for(let i=1;i<=15;i++){ setTimeout(() => { fetch('http://localhost:4000/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({site_id:'site-1',event_type:'page_view',path:'/pricing',user_id:'new_user_'+i,timestamp:new Date().toISOString()})}); console.log('User '+i+' clicked /pricing!'); }, i * 200); }"
```

### Test 2: The "Loyal User" Test
This is the ultimate test of the backend architecture. This script simulates **one single user** (`loyal_user_99`) clicking the `/about` page 20 times in a row. 

When you run this script, watch the Dashboard closely: you will see the **Total Views** skyrocket by 20, but the **Unique Users** count will remain completely frozen! This proves the Redis Sets algorithm correctly filters out duplicates.

```bash
node -e "for(let i=1;i<=20;i++){ setTimeout(() => { fetch('http://localhost:4000/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({site_id:'site-1',event_type:'page_view',path:'/about',user_id:'loyal_user_99',timestamp:new Date().toISOString()})}); console.log('loyal_user_99 clicked /about (View #'+i+')'); }, i * 200); }"
```

---

## 🔮 Future Improvements
- Implement HyperLogLog in Redis for even faster unique user calculations at a massive scale.
- Swap out the basic Redis queue for Apache Kafka or AWS SQS for enterprise-grade durability.
- Dockerize the entire project using `docker-compose.yml` for instant zero-dependency setups.
