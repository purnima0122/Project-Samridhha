# Project Samridhha

Financial literacy + stock learning platform focused on Nepal's market context.

## Explore More

- Portfolio / WebDev page: `ADD-YOUR-PORTFOLIO-LINK-HERE`
- If this repo was discovered from your portfolio, this is the source project behind the StockLearn experience.

## What This Project Includes

### 1) StockLearn Mobile App
- Path: [StockLaern](./StockLaern)
- Stack: Expo + React Native + TypeScript
- Highlights:
  - Learning tab with chapter-based lesson flow
  - Flashcards + quizzes + progress tracking
  - Dashboard, watchlist, alerts, market/news/regulator screens
  - Auth + user profile flows

### 2) Backend API
- Path: [backend-nest](./backend-nest)
- Stack: NestJS + MongoDB + Mongoose
- Highlights:
  - Auth (including Google OAuth support)
  - Lessons + quiz content APIs
  - Progress, streaks, badges, gamification
  - Dashboard, watchlist, alerts, news, regulator endpoints
  - Seed support for lesson curriculum

### 3) Data Server (Market Simulation + Signals)
- Path: [Data-Server](./Data-Server)
- Stack: Flask + Socket.IO + pandas/numpy
- Highlights:
  - NEPSE-style simulated real-time ticks
  - Spike detection + advisory scoring
  - Market status logic and alert processing
  - REST + WebSocket endpoints

### 4) Data Assets
- Path: [Data](./Data)
- Includes large stock/company CSV datasets and price history used by simulation/analysis.

## Project Structure

```text
Project-Samridhha/
|-- StockLaern/      # Mobile app (Expo/React Native)
|-- backend-nest/    # Main backend API (NestJS)
|-- Data-Server/     # Python market simulation + websocket server
`-- Data/            # CSV datasets (company + price history)
```

## Quick Start

### Data Server (Python, default port 4000)

```bash
cd Data-Server
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

### Backend API (NestJS, default port 3000)

```bash
cd backend-nest
npm install
npm run start:dev
```

### Mobile App (Expo)

```bash
cd StockLaern
npm install
npm start
```

## Lesson/Quiz Seeding

The main curriculum seed file is:

- [backend-nest/seed/lessons.nepal-finlit-curriculum.json](./backend-nest/seed/lessons.nepal-finlit-curriculum.json)

Run:

```bash
cd backend-nest
node seed/run-lesson-seed.js --dry-run
node seed/run-lesson-seed.js
```

Useful options:

```bash
node seed/run-lesson-seed.js --help
node seed/run-lesson-seed.js --mode replace-all
node seed/run-lesson-seed.js --mode replace-module --module "Money 101"
node seed/run-lesson-seed.js --file seed/lessons.nepal-finlit-curriculum.json
```

## Notes

- `StockLaern` folder name is intentionally kept as-is to match current project setup.
- For environment variables, use `.env` files inside `backend-nest` and `Data-Server`.
