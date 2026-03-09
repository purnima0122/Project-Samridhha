# Project Samridhha

This repo contains 3 main components:

1. **[Data Server](./Data-Server)**: Python/Flask server that simulates NEPSE market data and broadcasts ticks via Socket.IO.
2. **[Backend API](./backend-nest)**: NestJS REST API for user management, portfolio tracking, and business logic.
3. **[Mobile App](./StockLaern)**: React Native (Expo) mobile application for users.

## Quick Start

### 1. Data Server (Python)
Simulates market data. Runs on port `4000` by default.

```bash
cd Data-Server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

### 2. Backend API (NestJS)
Main application API. Runs on port `3000` by default.

```bash
cd backend-nest
npm install
npm run start:dev
```

### 3. Mobile App (Expo)
User interface.

```bash
cd StockLaern
npm install
npm start
```
