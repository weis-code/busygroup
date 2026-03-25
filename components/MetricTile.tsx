interface MetricTileProps {
  label: string;
  value: string | number;
  trend?: number;
  suffix?: string;
}

export default function MetricTile({ label, value, trend, suffix }: MetricTileProps) {
  return (
    <div style={{
      background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '8px', padding: '16px 20px',
      display: 'flex', flexDirection: 'column', gap: '6px',
      flex: 1, minWidth: 0,
    }}>
      <span style={{ fontSize: '11px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ fontSize: '28px', fontWeight: 700, color: '#ECF0F1', lineHeight: 1 }}>
          {value}
        </span>
        {suffix && <span style={{ fontSize: '13px', color: '#667788' }}>{suffix}</span>}
      </div>
      {trend !== undefined && (
        <span style={{
          fontSize: '11px',
          color: trend >= 0 ? '#2ECC71' : '#E74C3C',
        }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)} vs. forrige uge
        </span>
      )}
    </div>
  );
}
