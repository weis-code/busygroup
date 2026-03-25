# BusyGroup Agent Dashboard

AI-drevet salgsagent dashboard til BusyConsulting's svenske og danske marked.

## Setup

```bash
# 1. Installer dependencies
npm install

# 2. Konfigurér environment variabler
# Åbn .env.local og indsæt dine API nøgler

# 3. Seed databasen med testdata
npx tsx lib/seed.ts

# 4. Start development serveren
npm run dev
```

Dashboard: **http://localhost:3000**

## Kør agenter

```bash
# Start agent runner (kører alle cron jobs)
npx tsx agents/runner.ts
```

Eller klik "Kør nu" i dashboardet.

## Arkitektur

- Dashboard: http://localhost:3000
- Database: ./busygroup.db (SQLite via better-sqlite3)
- Agenter: /agents/ — cron schedule via runner.ts
- Slack: #busygroup-ledelse, #agent-salg-sverige, #agent-alerts

## Agent planlægning

| Agent | Tidspunkt | Beskrivelse |
|-------|-----------|-------------|
| CSO Agent | Mandag 07:00 | Pipeline analyse + ugentlig rapport |
| SE Prospecting | Mandag 08:00 | Finder 20 nye svenske leads |
| SE Outreach | Mandag 09:00 | LinkedIn DMs til nye leads (på svensk) |
| SE Follow-up | Daglig 08:30 | 4-trins follow-up sekvenser |
| SE Booking | Daglig 09:00 | Booker møder med interesserede leads |

## Tech Stack

- Next.js 14 (App Router, TypeScript)
- Tailwind CSS (dark theme)
- @xyflow/react – org chart
- Recharts – pipeline analytics
- @dnd-kit/core – kanban drag-and-drop
- better-sqlite3 – SQLite database
- @anthropic-ai/sdk – Claude API
- @slack/web-api – Slack integration
- sonner – toast notifikationer
