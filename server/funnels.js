/**
 * Funnel-Filter: Gesamt plus je Funnel eine eigene Ansicht mit eigenen KPIs.
 *
 * config/project.config.json -> "funnels": [
 *   { "key": "vsl", "label": "Neukunden VSL",
 *     "landingPages": ["finest-audience.com/neukunden"],
 *     "campaignNames": ["neukunden vsl"] }, …
 * ]
 *
 * Zuordnung je Zeile, erste Regel gewinnt:
 *   1. Spalte "Funnel" im Lead-Tab enthält eine der landingPages
 *   2. Kampagnenname (UTM) enthält einen der campaignNames
 *   3. nur Termine: E-Mail oder Telefon gehört zu einem Lead dieses Funnels
 * Was keinem Funnel zugeordnet werden kann, zählt nur in "Gesamt".
 *
 * Meta-Seite: Der Funnel ersetzt den Projekt-Bereich (scope). Eine Kampagne
 * gehört zum Funnel, wenn eine ihrer Anzeigen auf eine seiner Landingpages
 * verlinkt oder ihr Name passt. Dafür gilt dieselbe Logik wie in scope.js.
 */

const low = (s) => String(s ?? '').toLowerCase();
const has = (text, needles) => (needles || []).some((n) => n && low(text).includes(low(n)));
const phoneKey = (s) => {
  const d = String(s ?? '').replace(/\D/g, '');
  return d.length >= 7 ? d.slice(-9) : '';
};

/** Funnels aus der Config, bereinigt. Leere Liste = keine Funnel-Tabs. */
export function funnelList(project) {
  return (project?.funnels || [])
    .filter((f) => f && f.key && f.label)
    .map((f) => ({
      key: String(f.key),
      label: String(f.label),
      landingPages: f.landingPages || [],
      campaignNames: f.campaignNames || [],
    }));
}

function matchRow(row, funnels, campaignOf) {
  for (const f of funnels) if (row.funnel && has(row.funnel, f.landingPages)) return f.key;
  const campaign = campaignOf(row);
  for (const f of funnels) if (campaign && has(campaign, f.campaignNames)) return f.key;
  return '';
}

/**
 * Setzt `funnelKey` auf jeder Lead-, Ticket- und Termin-Zeile (parsed, vor
 * buildDataset). Verändert die Zeilen direkt und gibt parsed zurück.
 */
export function assignFunnels(parsed, funnels, utmRoles = {}) {
  if (!funnels.length) return parsed;
  const campaignRole = utmRoles.campaign || 'campaign';
  const campaignOf = (r) => r.utm?.[campaignRole] || '';
  const byMail = new Map();
  const byPhone = new Map();
  for (const l of parsed.leads || []) {
    l.funnelKey = matchRow(l, funnels, campaignOf);
    if (!l.funnelKey) continue;
    if (l.email && !byMail.has(l.email)) byMail.set(l.email, l.funnelKey);
    const pk = phoneKey(l.phone);
    if (pk && !byPhone.has(pk)) byPhone.set(pk, l.funnelKey);
  }
  for (const t of parsed.tickets || []) t.funnelKey = matchRow(t, funnels, campaignOf) || byMail.get(t.email) || '';
  for (const a of parsed.appointments || []) {
    a.funnelKey = matchRow(a, funnels, campaignOf) || byMail.get(a.email) || byPhone.get(phoneKey(a.phone)) || '';
  }
  return parsed;
}

/** Nur die Zeilen eines Funnels (leerer key = alles). */
export function filterParsed(parsed, key) {
  if (!key) return parsed;
  const keep = (rows) => (rows || []).filter((r) => r.funnelKey === key);
  return { ...parsed, leads: keep(parsed.leads), tickets: keep(parsed.tickets), appointments: keep(parsed.appointments) };
}

/** Meta-Bereich für einen Funnel (Format wie project.scope). */
export function funnelScope(funnel) {
  return { landingPages: funnel.landingPages, campaignNames: funnel.campaignNames };
}
