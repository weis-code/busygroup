'use client';

import { useState, useEffect } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalEvent {
  id: string;
  title: string;
  dayOffset: number; // 0=Mon, 1=Tue, … 5=Sat (relative to week start Mon)
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  color: string;
  bg: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // 0=Mon
}

const DA_MONTHS = [
  'Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'December',
];
const DA_WEEKDAYS_SHORT = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'];
const DA_WEEKDAYS_LONG  = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// ─── Static mock events (dayOffset relative to Monday of current week) ────────

const BASE_EVENTS: Omit<CalEvent, 'id'>[] = [
  { title: 'Stand-up · Hele teamet', dayOffset: 0, startHour: 9,  startMin: 0,  endHour: 9,  endMin: 30, color: '#60A5FA', bg: 'rgba(24,95,165,0.25)' },
  { title: 'LEGO — Strategi kick-off', dayOffset: 1, startHour: 12, startMin: 0,  endHour: 14, endMin: 0,  color: '#4ADE80', bg: 'rgba(46,204,113,0.2)'  },
  { title: 'Ørsted projektmøde',       dayOffset: 2, startHour: 8,  startMin: 0,  endHour: 9,  endMin: 0,  color: '#C084FC', bg: 'rgba(155,89,182,0.22)' },
  { title: '1:1 Lars Nielsen',          dayOffset: 2, startHour: 11, startMin: 0,  endHour: 11, endMin: 30, color: '#94A3B8', bg: 'rgba(100,116,139,0.22)'},
  { title: 'Stand-up',                  dayOffset: 3, startHour: 9,  startMin: 0,  endHour: 9,  endMin: 30, color: '#60A5FA', bg: 'rgba(24,95,165,0.25)' },
  { title: 'Maersk — Afsluttende pitch',dayOffset: 3, startHour: 13, startMin: 0,  endHour: 14, endMin: 30, color: '#F87171', bg: 'rgba(231,76,60,0.22)'  },
  { title: 'Frokost · Peter Madsen',    dayOffset: 4, startHour: 10, startMin: 0,  endHour: 11, endMin: 0,  color: '#4ADE80', bg: 'rgba(46,204,113,0.2)'  },
  { title: 'Pipeline review · Ledelsen',dayOffset: 4, startHour: 11, startMin: 0,  endHour: 12, endMin: 0,  color: '#F87171', bg: 'rgba(231,76,60,0.22)'  },
  { title: 'Salgsreview Q4',            dayOffset: 4, startHour: 12, startMin: 0,  endHour: 13, endMin: 0,  color: '#FB923C', bg: 'rgba(243,156,18,0.22)' },
  { title: 'Stand-up',                  dayOffset: 5, startHour: 9,  startMin: 0,  endHour: 9,  endMin: 30, color: '#60A5FA', bg: 'rgba(24,95,165,0.25)' },
  { title: 'Teamfredagsbar 🎉',         dayOffset: 5, startHour: 15, startMin: 0,  endHour: 17, endMin: 0,  color: '#C084FC', bg: 'rgba(155,89,182,0.22)' },
];

const EVENTS: CalEvent[] = BASE_EVENTS.map((e, i) => ({ ...e, id: String(i) }));

// ─── Constants ────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 08 – 18
const SLOT_HEIGHT = 64; // px per hour
const TIME_COL_W  = 52;
const DAY_COLS    = 6; // Mon–Sat

const MY_CALENDARS = [
  { label: 'Mads Busy',     color: '#F87171' },
  { label: 'Teamkalender',  color: '#60A5FA' },
  { label: 'Klientmøder',   color: '#4ADE80' },
  { label: 'Ferie/Fravær',  color: '#C084FC' },
  { label: 'Deadlines',     color: '#FBBF24' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function MiniCalendar({
  viewDate,
  today,
  weekStart,
  onNavigate,
  onSelectDay,
}: {
  viewDate: Date;
  today: Date;
  weekStart: Date;
  onNavigate: (dir: -1 | 1) => void;
  onSelectDay: (d: Date) => void;
}) {
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = firstDayOfMonth(year, month);
  const days  = daysInMonth(year, month);
  const cells: (Date | null)[] = [];

  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));

  // pad to full grid
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ padding: '8px 10px 4px' }}>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button
          onClick={() => onNavigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AAB8C2', padding: 2, display: 'flex' }}
        >
          <ChevronLeft size={14} />
        </button>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#AAB8C2', letterSpacing: '0.03em' }}>
          {DA_MONTHS[month].toUpperCase()} {year}
        </span>
        <button
          onClick={() => onNavigate(1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AAB8C2', padding: 2, display: 'flex' }}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 2 }}>
        {DA_WEEKDAYS_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, color: '#445566', fontWeight: 600, padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {cells.map((date, idx) => {
          if (!date) return <div key={idx} />;
          const isToday    = isSameDay(date, today);
          const inWeek     = date >= weekStart && date < addDays(weekStart, 6);
          const isSun      = date.getDay() === 0;
          return (
            <button
              key={idx}
              onClick={() => onSelectDay(date)}
              style={{
                padding: '3px 0',
                borderRadius: 5,
                border: 'none',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: isToday ? 700 : 400,
                color: isToday ? '#fff' : isSun ? '#445566' : inWeek ? '#ECF0F1' : '#667788',
                background: isToday
                  ? '#F97316'
                  : inWeek
                  ? 'rgba(24,95,165,0.18)'
                  : 'transparent',
                textAlign: 'center',
              }}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [today]     = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()));
  const [miniDate,  setMiniDate]  = useState(() => getMondayOf(new Date()));
  const [view,      setView]      = useState<'dag' | 'uge' | 'maaned'>('uge');

  // When week changes, keep mini calendar in sync
  useEffect(() => {
    setMiniDate(weekStart);
  }, [weekStart]);

  const weekEnd       = addDays(weekStart, 5); // Sat
  const weekNumber    = getWeekNumber(weekStart);
  const monthLabel    = DA_MONTHS[weekStart.getMonth()];
  const yearLabel     = weekStart.getFullYear();

  const weekDays: Date[] = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));

  // Navigate week
  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d, 7));
  const goToday  = () => setWeekStart(getMondayOf(today));

  // Mini cal month nav
  const miniNav = (dir: -1 | 1) => {
    setMiniDate(d => {
      const nd = new Date(d);
      nd.setDate(1);
      nd.setMonth(nd.getMonth() + dir);
      return nd;
    });
  };

  // Click a mini-cal day → jump to that week
  const selectMiniDay = (d: Date) => {
    setWeekStart(getMondayOf(d));
  };

  // Compute now indicator position
  const now = new Date();
  const nowMinutesSince8 = (now.getHours() - 8) * 60 + now.getMinutes();
  const showNowLine = isSameDay(now, today) && nowMinutesSince8 >= 0 && nowMinutesSince8 <= 10 * 60;
  const nowTop = (nowMinutesSince8 / 60) * SLOT_HEIGHT;

  // Column for today in this week (0-5 for Mon-Sat, -1 if not visible)
  const todayColIdx = weekDays.findIndex(d => isSameDay(d, today));

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0B1520', overflow: 'hidden', fontFamily: 'inherit' }}>

      {/* ── Left panel ──────────────────────────────────────────────────── */}
      <div style={{ width: 250, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', background: '#0B1520', overflowY: 'auto' }}>

        {/* New event button */}
        <div style={{ padding: '16px 14px 10px' }}>
          <button style={{
            width: '100%', background: '#F97316', border: 'none', borderRadius: 9,
            padding: '10px 0', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            boxShadow: '0 2px 12px rgba(249,115,22,0.35)',
          }}>
            <Plus size={14} /> Ny begivenhed
          </button>
        </div>

        {/* Mini calendar */}
        <MiniCalendar
          viewDate={miniDate}
          today={today}
          weekStart={weekStart}
          onNavigate={miniNav}
          onSelectDay={selectMiniDay}
        />

        <div style={{ margin: '16px 14px 8px', height: 1, background: 'rgba(255,255,255,0.05)' }} />

        {/* My calendars */}
        <div style={{ padding: '0 14px' }}>
          <div style={{ fontSize: 10, color: '#445566', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
            Mine kalendere
          </div>
          {MY_CALENDARS.map(cal => (
            <div key={cal.label} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0', cursor: 'pointer' }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: cal.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#AAB8C2' }}>{cal.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main calendar area ───────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* ── Top bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: '#0B1520', flexShrink: 0,
        }}>
          {/* Nav arrows */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button onClick={prevWeek} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '5px 8px', color: '#AAB8C2', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={15} />
            </button>
            <button onClick={nextWeek} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '5px 8px', color: '#AAB8C2', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Today */}
          <button onClick={goToday} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '5px 13px', color: '#ECF0F1', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            I dag
          </button>

          {/* Week title */}
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#ECF0F1' }}>
              Uge {weekNumber}
            </span>
            <span style={{ fontSize: 14, color: '#667788', marginLeft: 8 }}>
              — {monthLabel} {yearLabel}
            </span>
          </div>

          {/* View tabs */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'hidden' }}>
            {(['dag', 'uge', 'maaned'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: view === v ? 600 : 400,
                  background: view === v ? 'rgba(24,95,165,0.35)' : 'transparent',
                  color: view === v ? '#ECF0F1' : '#667788',
                  borderRight: v !== 'maaned' ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  transition: 'background 0.15s',
                }}
              >
                {v === 'dag' ? 'Dag' : v === 'uge' ? 'Uge' : 'Måned'}
              </button>
            ))}
          </div>
        </div>

        {/* ── "Coming soon" for non-week views ── */}
        {view !== 'uge' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#445566', gap: 10 }}>
            <div style={{ fontSize: 32, opacity: 0.2 }}>📅</div>
            <div style={{ fontSize: 15, color: '#AAB8C2' }}>{view === 'dag' ? 'Dagvisning' : 'Månedvisning'} kommer snart</div>
            <div style={{ fontSize: 12, color: '#445566' }}>Skift til Uge for at se din kalender</div>
          </div>
        )}

        {/* ── Week grid ── */}
        {view === 'uge' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Day headers */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              {/* time gutter */}
              <div style={{ width: TIME_COL_W, flexShrink: 0 }} />
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, today);
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1, padding: '10px 0 8px', textAlign: 'center',
                      borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}
                  >
                    <div style={{ fontSize: 10, color: '#445566', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                      {DA_WEEKDAYS_LONG[i].substring(0, 3).toUpperCase()}
                    </div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 30, height: 30, borderRadius: '50%',
                      background: isToday ? '#F97316' : 'transparent',
                      fontSize: 14, fontWeight: isToday ? 700 : 500,
                      color: isToday ? '#fff' : '#ECF0F1',
                    }}>
                      {day.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Scrollable time grid */}
            <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
              <div style={{ display: 'flex', position: 'relative', minHeight: SLOT_HEIGHT * HOURS.length }}>

                {/* Time labels */}
                <div style={{ width: TIME_COL_W, flexShrink: 0, position: 'relative' }}>
                  {HOURS.map(h => (
                    <div
                      key={h}
                      style={{
                        position: 'absolute', top: (h - 8) * SLOT_HEIGHT - 8,
                        width: TIME_COL_W, textAlign: 'right', paddingRight: 10,
                        fontSize: 10, color: '#445566', fontWeight: 500, userSelect: 'none',
                      }}
                    >
                      {String(h).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map((day, colIdx) => {
                  const colEvents = EVENTS.filter(e => e.dayOffset === colIdx);
                  const isToday   = isSameDay(day, today);

                  return (
                    <div
                      key={colIdx}
                      style={{
                        flex: 1, position: 'relative',
                        borderLeft: '1px solid rgba(255,255,255,0.04)',
                        background: isToday ? 'rgba(249,115,22,0.025)' : 'transparent',
                      }}
                    >
                      {/* Hour lines */}
                      {HOURS.map(h => (
                        <div
                          key={h}
                          style={{
                            position: 'absolute', top: (h - 8) * SLOT_HEIGHT,
                            left: 0, right: 0,
                            borderTop: '1px solid rgba(255,255,255,0.04)',
                            height: SLOT_HEIGHT,
                          }}
                        />
                      ))}

                      {/* Now indicator */}
                      {showNowLine && todayColIdx === colIdx && (
                        <div style={{ position: 'absolute', top: nowTop, left: 0, right: 0, zIndex: 10, pointerEvents: 'none' }}>
                          <div style={{ height: 2, background: '#F97316', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: -4, top: -4, width: 10, height: 10, borderRadius: '50%', background: '#F97316' }} />
                          </div>
                        </div>
                      )}

                      {/* Events */}
                      {colEvents.map(ev => {
                        const topMin  = (ev.startHour - 8) * 60 + ev.startMin;
                        const durMin  = (ev.endHour - ev.startHour) * 60 + (ev.endMin - ev.startMin);
                        const top     = (topMin / 60) * SLOT_HEIGHT + 1;
                        const height  = Math.max((durMin / 60) * SLOT_HEIGHT - 3, 20);

                        return (
                          <div
                            key={ev.id}
                            title={ev.title}
                            style={{
                              position: 'absolute',
                              top, left: 3, right: 3, height,
                              background: ev.bg,
                              border: `1px solid ${ev.color}33`,
                              borderLeft: `3px solid ${ev.color}`,
                              borderRadius: 6,
                              padding: '3px 7px',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              zIndex: 2,
                              transition: 'filter 0.12s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.2)')}
                            onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
                          >
                            <div style={{ fontSize: 10, fontWeight: 600, color: ev.color, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ev.title}
                            </div>
                            {height > 28 && (
                              <div style={{ fontSize: 9, color: ev.color, opacity: 0.75, marginTop: 1 }}>
                                {String(ev.startHour).padStart(2,'0')}:{String(ev.startMin).padStart(2,'0')} – {String(ev.endHour).padStart(2,'0')}:{String(ev.endMin).padStart(2,'0')}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
