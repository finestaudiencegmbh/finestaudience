/**
 * Funnel-Tabs: Zuordnung der Zeilen (Spalte "Funnel", Kampagnenname, bei
 * Terminen E-Mail/Telefon des Leads), Filter je Funnel, Zahlen an den Tabs und
 * der Meta-Bereich je Funnel. Ausführen: node server/funnels.test.mjs
 */
import assert from 'node:assert/strict';
import { parseSheets } from './parser.js';
import { buildDataset } from './build.js';
import { loadProjectConfig } from './project.js';
import { loadScoringConfig } from './scoring.js';
import { applyScope } from './scope.js';
import { assignFunnels, filterParsed, funnelCounts, funnelList, funnelScope } from './funnels.js';

const P = loadProjectConfig();
const FUNNELS = funnelList(P);
assert.deepEqual(FUNNELS.map((f) => f.key), ['vsl', 'vorlagen'], 'zwei Funnels aus der Config');

const VSL = 'Neukunden VSL | ABO Leads | 03.11.2026';
const FV = 'Funnel Vorlagen | ABO Leads | 03.11.2026';
const HEAD = ['Datum', 'Name', 'E-Mail', 'Telefon ', 'UTM Source', 'UTM Medium', 'UTM  Campaign', 'UTM Term', 'Funnel'];
const tabs = [
  { title: 'VSL Leads', values: [HEAD,
    ['2026-11-03 18:40:18 +0000', 'Susanne', 'susanne@example.com', '4915228486448', 'AG1: Neukunden VSL | DACH Broad', 'AG1 ABO VSL | Ad01', VSL, '120251112855380214', 'finest-audience.com/neukunden'],
    ['2026-11-03 19:00:00 +0000', 'Paul', 'paul@example.com', '491700000009', 'AG1: Neukunden VSL | DACH Broad', 'AG1 ABO VSL | Ad03', VSL, '', 'finest-audience.com/neukunden'],
  ] },
  { title: 'Funnel Vorlagen Leads', values: [HEAD,
    ['2026-11-03 18:57:31 +0000', 'Nö', 'noe@example.com', '+49848181825', 'AG1: Funnel Vorlagen | DACH Broad', 'AG1 FV ABO C2 | FV Umsatzrekorde', FV, '120251113443110214', 'finest-audience.com/landingpage-vorlage'],
    ['2026-11-03 20:49:46 +0000', 'Thar', 'thar@example.com', '+491638067729', '', '', '', '', 'finest-audience.com/landingpage-vorlage'],
    // Funnel-Spalte leer: Zuordnung über den Kampagnennamen
    ['2026-11-02 10:00:00 +0000', 'Ida', 'ida@example.com', '', 'AG1: Funnel Vorlagen | DACH Broad', 'AG1 FV | C1', FV, '', ''],
    // gar nicht zuordenbar: zählt nur in Gesamt
    ['2026-11-02 11:00:00 +0000', 'Otto', 'otto@example.com', '', '', '', '', '', ''],
  ] },
  { title: 'Setting Calls', values: [
    ['Datum', 'Vorname', 'Nachname', 'E-Mail', 'Telefon ', 'Datum Setting Call', 'Name Setter', 'UTM Source', 'UTM Medium', 'UTM  Campaign', 'UTM Term', 'UTM Content', 'Quelle'],
    // mit UTM: über den Kampagnennamen
    ['2026-11-03 20:00:00', 'Susanne', 'P', 'susanne@example.com', '4915228486448', '2026-11-05 10:00:00', 'Jan', 'AG1: Neukunden VSL | DACH Broad', 'AG1 ABO VSL | Ad01', VSL, '120251112855380214', '', 'PUBLIC_SCHEDULER'],
    // ohne UTM, andere E-Mail, gleiche Telefonnummer wie Lead "Nö" -> Funnel Vorlagen
    ['2026-11-03 21:00:00', 'Nö', 'X', 'noe.privat@example.com', '0848181825', '2026-11-06 10:00:00', 'Jan', '', '', '', '', '', 'PUBLIC_SCHEDULER'],
    // ohne UTM, E-Mail des Leads "Paul" -> VSL
    ['2026-11-03 21:30:00', 'Paul', 'Y', 'paul@example.com', '', '2026-11-06 11:00:00', 'Jan', '', '', '', '', '', 'PUBLIC_SCHEDULER'],
  ] },
];

const parsed = assignFunnels(parseSheets(tabs, P.sheet, P.features), FUNNELS, P.sheet.utmRoles);
const keyOf = (rows, mail) => rows.find((r) => r.email === mail)?.funnelKey;
assert.equal(keyOf(parsed.leads, 'susanne@example.com'), 'vsl', 'Funnel-Spalte -> VSL');
assert.equal(keyOf(parsed.leads, 'thar@example.com'), 'vorlagen', 'Funnel-Spalte ohne UTMs -> Vorlagen');
assert.equal(keyOf(parsed.leads, 'ida@example.com'), 'vorlagen', 'leere Funnel-Spalte -> Kampagnenname');
assert.equal(keyOf(parsed.leads, 'otto@example.com'), '', 'nicht zuordenbar');
assert.equal(keyOf(parsed.appointments, 'susanne@example.com'), 'vsl', 'Setting Call über Kampagnenname');
assert.equal(keyOf(parsed.appointments, 'noe.privat@example.com'), 'vorlagen', 'Setting Call über Telefon des Leads');
assert.equal(keyOf(parsed.appointments, 'paul@example.com'), 'vsl', 'Setting Call über E-Mail des Leads');

// --- Zahlen an den Tabs (Zeitraum 03.11.) ------------------------------------
const day = (l) => l.wonAt.slice(0, 10) === '2026-11-03';
assert.deepEqual(funnelCounts(parsed.leads, FUNNELS, day), { total: 4, counts: { vsl: 2, vorlagen: 2 } }, 'Tabs im Zeitraum');
assert.deepEqual(funnelCounts(parsed.leads, FUNNELS), { total: 6, counts: { vsl: 2, vorlagen: 3 } }, 'Gesamt enthält auch Nicht-Zuordenbare');

// --- Ansicht je Funnel: nur dessen Leads und Setting Calls --------------------
const view = (key) => buildDataset(filterParsed(structuredClone(parsed), key), loadScoringConfig(), P.features, P.sheet.utmRoles);
const all = view('');
const vsl = view('vsl');
const fv = view('vorlagen');
assert.equal(all.counts.leads, 6);
assert.equal(vsl.counts.leads, 2);
assert.equal(fv.counts.leads, 3);
assert.equal(vsl.counts.appointments, 2, 'VSL: Susanne + Paul');
assert.equal(fv.counts.appointments, 1, 'Vorlagen: Nö');
assert.ok(vsl.leads.every((l) => l.campaign === VSL), 'VSL-Ansicht nur mit VSL-Kampagne');
assert.equal(parsed.leads.length, 6, 'Rohdaten bleiben unverändert');

// --- Meta-Bereich je Funnel ----------------------------------------------------
const ent = (campaign, adId, spend) => ({ account: 'act_1', campaign, adset: 'AG1', creative: 'Ad', adId, spend });
const meta = {
  byAccount: [{
    account: 'act_1',
    entities: [ent(VSL, '1', 28), ent(FV, '2', 12), ent('Recruiting | Leads', '3', 50)],
    dailyEntities: [],
    adUrls: { 1: ['https://finest-audience.com/neukunden?x=1'], 2: ['https://finest-audience.com/landingpage-vorlage'], 3: ['https://jobs.example.com'] },
    adList: [], records: [],
  }],
};
const project = applyScope(meta, P.scope);
assert.deepEqual(project.excluded.map((c) => c.campaign), ['Recruiting | Leads'], 'Projekt-Bereich schließt Fremd-Kampagne aus');
const spendOf = (m) => m.byAccount[0].entities.reduce((s, e) => s + e.spend, 0);
assert.equal(spendOf(applyScope(project.meta, funnelScope(FUNNELS[0])).meta), 28, 'VSL-Spend');
assert.equal(spendOf(applyScope(project.meta, funnelScope(FUNNELS[1])).meta), 12, 'Vorlagen-Spend');

console.log('✓ Alle Funnel-Tests bestanden');
console.log('  Zuordnung über Funnel-Spalte, Kampagnenname, Lead-E-Mail/-Telefon; Spend je Funnel getrennt');
