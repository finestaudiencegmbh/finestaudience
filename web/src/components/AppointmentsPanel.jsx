import React, { useMemo } from 'react';
import { fmtEur, fmtInt, fmtPct, groupCount, appointmentsByTime } from '../lib.js';
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
 * Strang, berührt keine Lead-/Ticket-Zahl. `spend` = Adspend im Zeitraum.
 */
export default function AppointmentsPanel({ appointments, spend, hourlyDay }) {
  const { labels } = useProject();
  const A = labels.appointment;
  const list = appointments || [];
  const paid = list.filter((a) => a.sourceType === 'paid').length;
  const bookings = list.reduce((n, a) => n + (a.bookings || 1), 0);
  const noUtm = list.filter((a) => a.sourceGroup === 'Ohne UTM').length;
  const matched = list.filter((a) => a.matchedBy).length;
  const groups = useMemo(() => groupCount(list, (a) => a.sourceGroup, { emptyLabel: 'Ohne UTM' }), [list]);
  const series = useMemo(() => appointmentsByTime(list, hourlyDay), [list, hourlyDay]);
  const max = Math.max(1, ...groups.map((g) => g.count));

  const perSlot = [
    { key: 'total', label: A.many, color: AMBER, data: series.perSlot.map((d) => ({ date: d.date, value: d.total })) },
    { key: 'paid', label: 'davon Ads', color: SOURCE_COLORS['Meta Ads'], data: series.perSlot.map((d) => ({ date: d.date, value: d.paid })) },
  ];
  const cumulative = [
    { key: 'total', label: `${A.many} gesamt`, color: AMBER, data: series.cumulative.map((d) => ({ date: d.date, value: d.total })) },
    { key: 'paid', label: 'davon Ads', color: SOURCE_COLORS['Meta Ads'], data: series.cumulative.map((d) => ({ date: d.date, value: d.paid })) },
  ];
  const fmtY = (v) => fmtInt(Math.round(v));

  return (
    <div className="kpi-sections">
      <section className="kpi-section">
        <div className="kpi-section-head"><span className="kpi-dot" style={{ background: AMBER }} />{A.many}</div>
        <div className="kpi-grid">
          <Card label={`${A.many} gebucht`} value={fmtInt(list.length)} sub={bookings > list.length ? `${fmtInt(bookings)} Buchungen · ${fmtInt(bookings - list.length)} Umbuchungen/doppelt` : 'je Person gezählt'} />
          <Card label={`${A.many} aus Ads`} value={fmtInt(paid)} sub={list.length ? `${fmtPct(paid / list.length)} aller ${A.many}` : '–'} />
          <Card label={`Kosten / ${A.one}`} value={fmtEur(paid && spend ? spend / paid : null)} sub={`Adspend ÷ ${A.many} aus Ads`} />
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
        <div className="charts-grid appt-charts">
          {hourlyDay ? (
            <>
              <IntradayChart title={`${A.many} im Tagesverlauf`} formatY={fmtY} series={perSlot} />
              <IntradayChart title={`${A.many} kumuliert`} formatY={fmtY} series={cumulative} />
            </>
          ) : (
            <>
              <TimeChart title={`${A.many} pro Tag`} formatY={fmtY} series={perSlot} />
              <TimeChart title={`${A.many} kumuliert`} formatY={fmtY} series={cumulative} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
