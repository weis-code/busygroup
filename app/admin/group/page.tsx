'use client';

import { useEffect, useState } from 'react';

interface Company {
  id: number; name: string; slug: string; type: string;
  color: string; logo_initials: string; ownership_pct: number; stripe_enabled: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  sales: 'Salg', consulting: 'Konsultering', saas: 'SaaS', group: 'Gruppe',
};

export default function GroupPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  async function load() {
    const data = await fetch('/api/companies').then(r => r.json()) as Company[];
    setCompanies(data);
  }

  async function seed() {
    setSeeding(true);
    setSeedMsg('');
    const res = await fetch('/api/seed-platform').then(r => r.json()) as { ok?: boolean; error?: string };
    setSeedMsg(res.ok ? 'Platform seedet ✓' : (res.error ?? 'Fejl'));
    setSeeding(false);
  }

  useEffect(() => { load(); }, []);

  const group = companies.find(c => c.slug === 'group');
  const subs = companies.filter(c => c.slug !== 'group');

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Group overblik</h1>
          <div style={{ fontSize: 12, color: 'var(--t2)' }}>NextLevel Group — alle selskaber</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {seedMsg && <span style={{ fontSize: 12, color: 'var(--gr)' }}>{seedMsg}</span>}
          <button onClick={seed} disabled={seeding}
            style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>
            {seeding ? 'Seeder…' : 'Seed platform'}
          </button>
        </div>
      </div>

      {/* Group card */}
      {group && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, padding: '18px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: `${group.color}22`, border: `2px solid ${group.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: group.color, flexShrink: 0 }}>
            {group.logo_initials}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>{group.name}</div>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>Moderselskab • {group.ownership_pct}% ejet</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>Datterselskaber</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', marginTop: 2 }}>{subs.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* Company grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {subs.map(company => (
          <a key={company.id} href={`/admin/companies`}
            style={{ textDecoration: 'none', display: 'block', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, padding: '18px 20px', transition: 'all 0.12s', position: 'relative', overflow: 'hidden' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd2)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
          >
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: company.color }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${company.color}22`, border: `1.5px solid ${company.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: company.color, flexShrink: 0 }}>
                {company.logo_initials}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{company.name}</div>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>{TYPE_LABEL[company.type] ?? company.type}</div>
              </div>
              {company.stripe_enabled && (
                <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: 'var(--pu2)', color: 'var(--pu)', padding: '2px 8px', borderRadius: 100 }}>Stripe</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>Ejerandel</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginTop: 2 }}>{company.ownership_pct}%</div>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Navigation tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginTop: 28 }}>
        {[
          { href: '/admin/customers', label: 'Kunder', icon: '◎', color: 'var(--bl)' },
          { href: '/admin/handover', label: 'Handovers', icon: '◒', color: 'var(--gr)' },
          { href: '/admin/portal', label: 'Klientportal', icon: '◇', color: 'var(--pu)' },
          { href: '/admin/messages', label: 'Beskeder', icon: '◉', color: 'var(--ye)' },
        ].map(item => (
          <a key={item.href} href={item.href}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9, padding: '14px 16px', textDecoration: 'none', transition: 'all 0.12s', minHeight: 44 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd)'; }}
          >
            <span style={{ fontSize: 16, color: item.color }}>{item.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{item.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
