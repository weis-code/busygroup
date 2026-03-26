import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

// Singleton connection pool
let _sql: ReturnType<typeof postgres> | null = null;

export function getDb(): ReturnType<typeof postgres> {
  if (!_sql) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString && process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL environment variable is required');
    }
    // Railway internal URLs (.railway.internal) don't use SSL
    // External URLs or other production DBs do
    const isRailwayInternal = connectionString?.includes('.railway.internal');
    _sql = postgres(connectionString || 'postgresql://postgres:postgres@localhost:5432/busygroup', {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: isRailwayInternal ? false : process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
  }
  return _sql;
}

// Lazy sql proxy — defers connection until first actual DB call
// This prevents the connection attempt at module-load time (e.g., during `next build`)
export const sql = new Proxy({} as ReturnType<typeof postgres>, {
  get(_target, prop) {
    const instance = getDb();
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
  apply(_target, _thisArg, args) {
    return (getDb() as unknown as (...a: unknown[]) => unknown)(...args);
  },
}) as ReturnType<typeof postgres>;

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

  // Seed default agents if none exist
  const agentCount = await sql`SELECT COUNT(*) as cnt FROM agents`;
  if (Number(agentCount[0].cnt) === 0) {
    const agentSeeds = [
      { id: 'cso', name: 'CSO Agent', market: 'global' },
      { id: 'se-prospecting', name: 'SE Prospecting', market: 'sweden' },
      { id: 'se-outreach', name: 'SE Outreach', market: 'sweden' },
      { id: 'se-followup', name: 'SE Follow-up', market: 'sweden' },
      { id: 'se-booking', name: 'SE Booking', market: 'sweden' },
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
