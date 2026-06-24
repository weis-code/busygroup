'use client';

import { useEffect, useState } from 'react';

interface Company {
  id: number; name: string; slug: string; type: string;
  color: string; logo_initials: string; ownership_pct: number; stripe_enabled: boolean; created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  sales: 'Salg', consulting: 'Konsultering', saas: 'SaaS', group: 'Gruppe',
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);

  async function load() {
    const data = await fetch('/api/companies').then(r => r.json()) as Company[];
    setCompanies(data);
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Virksomheder</h1>
        <div style={{ fontSize: 12, color: 'var(--t2)' }}>Alle selskaber i NextLevel Group</div>
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, overflow: 'hidden' }}>
        <div style={{ padding: '11px 15px', borderBottom: '1px solid var(--bd)', background: 'var(--s2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
            <span>Navn</span><span>Type</span><span>Ejerandel</span><span>Stripe</span><span>Oprettet</span>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {companies.map((company, i) => (
            <div key={company.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '13px 15px', borderTop: i > 0 ? '1px solid var(--bd)' : 'none', alignItems: 'center', transition: 'background 0.1s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${company.color}22`, border: `1.5px solid ${company.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: company.color, flexShrink: 0 }}>
                  {company.logo_initials}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{company.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{company.slug}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--t2)' }}>{TYPE_LABEL[company.type] ?? company.type}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{company.ownership_pct}%</div>
              <div>
                {company.stripe_enabled
                  ? <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--pu2)', color: 'var(--pu)', padding: '2px 8px', borderRadius: 100 }}>Aktiv</span>
                  : <span style={{ fontSize: 10, color: 'var(--t3)' }}>—</span>
                }
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                {new Date(company.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          ))}
          {companies.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen virksomheder endnu</div>
          )}
        </div>
      </div>
    </div>
  );
}
