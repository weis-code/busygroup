import { CSSProperties, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  title?: string;
}

export default function Card({ children, style, title }: CardProps) {
  return (
    <div style={{
      background: '#111E2A',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '10px',
      ...style,
    }}>
      {title && (
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          fontSize: '13px', fontWeight: 600, color: '#ECF0F1',
        }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
