import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

// postgres() is lazy — no connection is made until a query runs.
// Safe to initialise at module load time (including during `next build`).
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/busygroup';

export const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: false, // Railway internal network (.railway.internal) does not use SSL
});

// Schema initialization — kald denne ved server startup
export async function initSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      market TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      last_action TEXT,
      last_run TEXT,
      runs_today INTEGER DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      contact_name TEXT,
      contact_title TEXT,
      linkedin_url TEXT,
      email TEXT,
      phone TEXT,
      company_size TEXT,
      why_they_fit TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'new',
      market TEXT NOT NULL DEFAULT 'sweden',
      brief_ready INTEGER NOT NULL DEFAULT 0,
      brief_updated_at TEXT,
      followup_draft_ready INTEGER NOT NULL DEFAULT 0,
      nurture_active INTEGER NOT NULL DEFAULT 0,
      assigned_to TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS agent_logs (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      lead_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      result TEXT DEFAULT 'info',
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS outreach_sequences (
      id TEXT PRIMARY KEY,
      lead_id TEXT REFERENCES leads(id),
      step INTEGER NOT NULL DEFAULT 1,
      channel TEXT NOT NULL DEFAULT 'email',
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_for TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      lead_id TEXT REFERENCES leads(id),
      title TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 60,
      status TEXT DEFAULT 'scheduled',
      notes TEXT,
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'mrr',
      currency TEXT NOT NULL DEFAULT 'DKK',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS lead_products (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      created_at TEXT NOT NULL,
      UNIQUE(lead_id, product_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      contact_name TEXT,
      contact_title TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      market TEXT NOT NULL DEFAULT 'denmark',
      mrr INTEGER NOT NULL DEFAULT 0,
      contract_start TEXT,
      contract_end TEXT,
      churn_risk TEXT NOT NULL DEFAULT 'low',
      health_score INTEGER DEFAULT 80,
      segment TEXT DEFAULT 'smb',
      notes TEXT,
      assigned_to TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS customer_products (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      created_at TEXT NOT NULL,
      UNIQUE(customer_id, product_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS customer_notes (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      content TEXT NOT NULL,
      created_by TEXT DEFAULT 'human',
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS briefs (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      type TEXT NOT NULL DEFAULT 'call',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'dk-callprep-agent'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS daily_digest (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      urgent TEXT NOT NULL DEFAULT '[]',
      follow_ups_due TEXT NOT NULL DEFAULT '[]',
      meetings_today TEXT NOT NULL DEFAULT '[]',
      suggested_focus TEXT,
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'seller',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_login TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS import_sessions (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      market TEXT NOT NULL DEFAULT 'denmark',
      status TEXT NOT NULL DEFAULT 'pending',
      total_rows INTEGER NOT NULL DEFAULT 0,
      processed_rows INTEGER NOT NULL DEFAULT 0,
      skipped_rows INTEGER NOT NULL DEFAULT 0,
      created_leads INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    )
  `;

  // Also create notes table (used by agents for lead notes)
  await sql`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      lead_id TEXT REFERENCES leads(id),
      content TEXT NOT NULL,
      created_by TEXT DEFAULT 'human',
      created_at TEXT NOT NULL
    )
  `;

  // IMAP accounts — en post per email-konto
  await sql`
    CREATE TABLE IF NOT EXISTS imap_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 993,
      tls BOOLEAN NOT NULL DEFAULT true,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      last_sync TEXT,
      created_at TEXT NOT NULL,
      smtp_host TEXT,
      smtp_port INTEGER DEFAULT 587,
      smtp_secure BOOLEAN DEFAULT false,
      smtp_user TEXT,
      smtp_password TEXT,
      user_id TEXT
    )
  `;

  // Tilføj SMTP-kolonner til eksisterende tabel (migration)
  await sql`ALTER TABLE imap_accounts ADD COLUMN IF NOT EXISTS smtp_host TEXT`.catch(() => {});
  await sql`ALTER TABLE imap_accounts ADD COLUMN IF NOT EXISTS smtp_port INTEGER DEFAULT 587`.catch(() => {});
  await sql`ALTER TABLE imap_accounts ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT false`.catch(() => {});
  await sql`ALTER TABLE imap_accounts ADD COLUMN IF NOT EXISTS smtp_user TEXT`.catch(() => {});
  await sql`ALTER TABLE imap_accounts ADD COLUMN IF NOT EXISTS smtp_password TEXT`.catch(() => {});
  await sql`ALTER TABLE imap_accounts ADD COLUMN IF NOT EXISTS user_id TEXT`.catch(() => {});

  // Unified message store — indgående (IMAP) + udgående (Resend)
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      imap_account_id TEXT REFERENCES imap_accounts(id),
      imap_uid INTEGER,
      direction TEXT NOT NULL DEFAULT 'inbound',
      from_email TEXT NOT NULL,
      from_name TEXT,
      to_email TEXT NOT NULL,
      to_name TEXT,
      subject TEXT,
      body_text TEXT,
      body_html TEXT,
      message_id TEXT,
      in_reply_to TEXT,
      lead_id TEXT REFERENCES leads(id),
      customer_id TEXT REFERENCES customers(id),
      read BOOLEAN NOT NULL DEFAULT false,
      received_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_messages_from_email ON messages(from_email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_to_email ON messages(to_email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at DESC)`;

  // ── Intern chat (Messenger) ────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL DEFAULT 'direct',  -- 'direct' | 'group'
      name        TEXT,                             -- kun for grupper
      created_by  TEXT REFERENCES users(id),
      created_at  TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS chat_members (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_read_at    TEXT,
      joined_at       TEXT NOT NULL,
      UNIQUE(conversation_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      sender_id       TEXT NOT NULL REFERENCES users(id),
      content         TEXT NOT NULL,
      created_at      TEXT NOT NULL
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id)`;

  // Mail upgrades
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT false`.catch(() => {});
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS draft BOOLEAN DEFAULT false`.catch(() => {});
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_id TEXT`.catch(() => {});
  await sql`ALTER TABLE imap_accounts ADD COLUMN IF NOT EXISTS last_uid INTEGER DEFAULT 0`.catch(() => {});
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id)`.catch(() => {});
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id)`.catch(() => {});

  // ── Projektstyring (Kanban) ────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS project_boards (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      owner_id    TEXT REFERENCES users(id),
      visibility  TEXT NOT NULL DEFAULT 'private',
      color       TEXT NOT NULL DEFAULT '#E84025',
      customer_id TEXT REFERENCES customers(id),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS project_board_members (
      id       TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES project_boards(id) ON DELETE CASCADE,
      user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role     TEXT NOT NULL DEFAULT 'member',
      UNIQUE(board_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS project_columns (
      id         TEXT PRIMARY KEY,
      board_id   TEXT NOT NULL REFERENCES project_boards(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      position   INTEGER NOT NULL DEFAULT 0,
      color      TEXT NOT NULL DEFAULT '#334455',
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS project_tasks (
      id          TEXT PRIMARY KEY,
      board_id    TEXT NOT NULL REFERENCES project_boards(id) ON DELETE CASCADE,
      column_id   TEXT NOT NULL REFERENCES project_columns(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      description TEXT,
      assigned_to TEXT REFERENCES users(id),
      due_date    TEXT,
      priority    TEXT NOT NULL DEFAULT 'medium',
      labels      TEXT NOT NULL DEFAULT '[]',
      position    INTEGER NOT NULL DEFAULT 0,
      customer_id TEXT REFERENCES customers(id),
      created_by  TEXT REFERENCES users(id),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS project_task_comments (
      id         TEXT PRIMARY KEY,
      task_id    TEXT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id),
      content    TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;

  // ── Kunde portal adgang ───────────────────────────────────────────────────
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT false`.catch(() => {});
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_email TEXT`.catch(() => {});
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_password_hash TEXT`.catch(() => {});
  await sql`ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS done BOOLEAN DEFAULT false`.catch(() => {});

  // Seed default agents if none exist
  const agentCount = await sql`SELECT COUNT(*) as cnt FROM agents`;
  if (Number(agentCount[0].cnt) === 0) {
    const agentSeeds = [
      { id: 'cso', name: 'CSO Agent', market: 'global' },
      { id: 'se-prospecting', name: 'SE Prospecting', market: 'sweden' },
      { id: 'se-outreach', name: 'SE Outreach', market: 'sweden' },
      { id: 'se-followup', name: 'SE Follow-up', market: 'sweden' },
      { id: 'se-booking', name: 'SE Booking', market: 'sweden' },
      { id: 'se-imap', name: 'SE IMAP (Svardetektion)', market: 'sweden' },
      { id: 'dk-callprep', name: 'DK Call Prep', market: 'denmark' },
      { id: 'dk-calllog', name: 'DK Call Log', market: 'denmark' },
      { id: 'dk-followup', name: 'DK Follow-up', market: 'denmark' },
      { id: 'dk-nurture', name: 'DK Nurture', market: 'denmark' },
      { id: 'dk-pipeline', name: 'DK Pipeline', market: 'denmark' },
      { id: 'dk-prospecting', name: 'DK Prospecting', market: 'denmark' },
    ];
    for (const a of agentSeeds) {
      await sql`INSERT INTO agents (id, name, market, status, runs_today, last_action, last_run) VALUES (${a.id}, ${a.name}, ${a.market}, ${'idle'}, ${0}, ${null}, ${null}) ON CONFLICT (id) DO NOTHING`;
    }
  }

  // Seed default admin user if no users exist
  const userCount = await sql`SELECT COUNT(*) as cnt FROM users`;
  if (Number(userCount[0].cnt) === 0) {
    const now = new Date().toISOString();
    const adminPassword = process.env.ADMIN_PASSWORD || 'BusyAdmin2025!';
    const sellerPassword = process.env.SELLER_PASSWORD || 'BusySeller2025!';
    await sql`INSERT INTO users (id, name, email, password_hash, role, active, created_at) VALUES (${randomUUID()}, 'Admin', 'admin@busyconsulting.dk', ${bcrypt.hashSync(adminPassword, 12)}, 'admin', 1, ${now})`;
    await sql`INSERT INTO users (id, name, email, password_hash, role, active, created_at) VALUES (${randomUUID()}, 'Test Sælger', 'saelger@busyconsulting.dk', ${bcrypt.hashSync(sellerPassword, 12)}, 'seller', 1, ${now})`;
    console.log('[DB] Seeded default users');
  }
}

export default sql;
