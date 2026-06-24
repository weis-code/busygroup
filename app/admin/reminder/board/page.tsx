'use client';

export default function ReminderBoardPage() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Reminder Board</h1>
      <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 24 }}>Projektstyring for Reminder</p>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '60px 40px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
        Board under opbygning
      </div>
    </div>
  );
}
