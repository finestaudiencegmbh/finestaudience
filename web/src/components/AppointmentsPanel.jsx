import React, { useMemo } from 'react';
import { fmtInt, groupCount, appointmentsByTime } from '../lib.js';
import { useProject } from '../project.jsx';
import TimeChart from './TimeChart.jsx';
import IntradayChart from './IntradayChart.jsx';

const AMBER = '#f5b84a';
// Feste Farben je Quellen-Gruppe, damit Dashboard und Quellen-Tab gleich aussehen
export const SOURCE_COLORS = { 'Meta Ads': '#d51b35', Affiliate: '#a78bfa', 'E-Mail': '#5ec8d8', ManyChat: '#6fcf97', 'Ohne UTM': '#6b6b6b' };
export const sourceColor = (group) => SOURCE_COLORS[group] || '#f5b84a';

function Card({ label, value, sub }) {
  return (
    <div className="kpi-card">
      <span className="kpi-accent" style={{ background: AMBER, color: AMBER }} />
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

/**
 * Termine aus dem Termin-Tab: Kacheln, Quellen-Balken und Verlauf. Eigener
 * Strang, berührt keine Lead-/Ticket-Zahl.
 */
export default function AppointmentsPanel({ appointments, hourlyDay }) {
  const { labels } = useProject();
  const A = labels.appointment;
  const list = appointments || [];
  const bookings = list.reduce((n, a) => n + (a.bookings || 1), 0);
  const noUtm = list.filter((a) => a.sourceGroup === 'Ohne UTM').length;
  const matched = list.filter((a) => a.matchedBy).length;
  const groups = useMemo(() => groupCount(list, (a) => a.sourceGroup, { emptyLabel: 'Ohne UTM' }), [list]);
  // Liegen alle Termine an EINEM Tag (z. B. Webinar-Tag), Uhrzeit-Verlauf
  // statt eines einzelnen Tagespunkts, auch wenn der Zeitraum länger ist.
  const day = useMemo(() => {
    if (hourlyDay) return hourlyDay;
    const days = new Set(list.map((a) => String(a.at || '').slice(0, 10)).filter(Boolean));
    return days.size === 1 ? [...days][0] : null;
  }, [list, hourlyDay]);
  const series = useMemo(() => appointmentsByTime(list, day), [list, day]);
  const max = Math.max(1, ...groups.map((g) => g.count));

  const perSlot = [
    { key: 'total', label: A.many, color: AMBER, data: series.perSlot.map((d) => ({ date: d.date, value: d.total })) },
    { key: 'paid', label: 'davon Ads', color: SOURCE_COLORS['Meta Ads'], data: series.perSlot.map((d) => ({ date: d.date, value: d.paid })) },
  ];
  const fmtY = (v) => fmtInt(Math.round(v));

  return (
    <div className="kpi-sections">
      <section className="kpi-section">
        <div className="kpi-section-head"><span className="kpi-dot" style={{ background: AMBER }} />{A.many}</div>
        <div className="kpi-grid">
          <Card label={`${A.many} gebucht`} value={fmtInt(list.length)} sub={bookings > list.length ? `${fmtInt(bookings)} Buchungen · ${fmtInt(bookings - list.length)} Umbuchungen/doppelt` : 'je Person gezählt'} />
          <Card label="Ohne UTM" value={fmtInt(noUtm)} sub={matched ? `${fmtInt(matched)} weitere über E-Mail/Telefon zugeordnet` : 'andere E-Mail bei der Buchung'} />
          <div className="kpi-card kpi-dist">
            <div className="kpi-label">{A.many} nach Quelle</div>
            <div className="dist-bars">
              {groups.map((g) => (
                <div key={g.key} className="dist-row appt-row">
                  <span className="dist-key appt-key" title={g.key}>{g.key}</span>
                  <div className="dist-track"><div className="dist-fill" style={{ width: `${(g.count / max) * 100}%`, background: sourceColor(g.key) }} /></div>
                  <span className="dist-count">{g.count}</span>
                </div>
              ))}
              {groups.length === 0 && <div className="muted">Keine {A.many} im Zeitraum.</div>}
            </div>
          </div>
        </div>
        <div className="appt-charts">
          {day
            ? <IntradayChart title={`${A.many} im Tagesverlauf · ${day.slice(8, 10)}.${day.slice(5, 7)}.`} formatY={fmtY} series={perSlot} />
            : <TimeChart title={`${A.many} pro Tag`} formatY={fmtY} series={perSlot} />}
        </div>
      </section>
    </div>
  );
}
