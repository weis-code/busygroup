# BusyGroup

Intern platform til at drive og følge op på tværs af koncernens selskaber: **Next Level Sales**, **Meridian Consulting**, **NextLevel Group**, **Quorex**, **BusyReminder**, **CreatorRate** og **Next Level Creator Agency**.

## Setup

```bash
# 1. Installer dependencies
npm install

# 2. Konfigurér environment variabler
# Opret .env.local med DATABASE_URL (Postgres) og evt. S3/OpenAI-nøgler til
# dokument-upload og opkalds-transskribering

# 3. Start development serveren
npm run dev
```

Dashboard: **http://localhost:3000**

Databaseskemaet oprettes/migreres automatisk ved boot via `instrumentation.ts` (Next.js' `register()`-hook) — der er ikke noget separat migrationstrin.

## Arkitektur

- **Next.js 14** (App Router, TypeScript), deployet på **Railway**
- **Postgres** som eneste datalag (via `postgres`-pakken, tagged-template SQL i `lib/db.ts`)
- Autentificering: cookie-baseret session (`lib/auth.ts`), roller `ADMIN` / `MANAGER` / `SELLER` (+ legacy `NLCA_MANAGER`)
- Selskabskontekst: `companies`-tabellen + `company_id` på brugere/data, håndteret i `lib/company-context.tsx`

## Moduler pr. selskab

- **Next Level Sales** (`app/admin/nls`, `app/dashboard`) — opgave-/kommissionsstyring (`tasks`, `sales`, `pay_periods`, `targets`), daglige mål, sitreps, opkaldsfeedback (transskribering + AI-feedback via `lib/transcription.ts`)
- **Meridian Consulting** (`app/admin/meridian`) — CRM-pipeline (`meridian_leads`), kunde-abonnementer (`customers`/`customer_products`), support-tickets (`meridian_tickets`)
- **NextLevel Group** (`app/admin/group`) — koncern-CRM (`crm_*`), HR/rekruttering (`hr_candidates`), finans-overblik, kunde-håndtering (`handovers`, `portal_access`)
- Fælles på tværs af selskaber: Messenger (kanaler + DM, `messenger_messages`), Kanban-boards (`kanban_*`), support/dev-tickets (`cr_tickets`)

## Tech Stack

- Next.js 14 (App Router, TypeScript)
- Postgres (`postgres`-pakken)
- @dnd-kit/core — kanban drag-and-drop
- @xyflow/react — org chart
- Recharts — analytics
- @anthropic-ai/sdk — Claude API (opgave-assistent, opkalds-feedback)
- @aws-sdk/client-s3 — dokument-/lydfil-upload
- bcryptjs — password hashing
