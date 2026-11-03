/**
 * Prüft die AKTUELLE Projekt-Konfiguration (config/project.config.json) für
 * Finest Audience: Branding, abgeschaltete Ticket-/Quali-/Termin-Stränge,
 * Tabellen-Erkennung der Lead-Tabs, UTM-Rollen und Ad-ID. Die Kopfzeilen sind
 * an den bisherigen Tracking-Sheets orientiert; sobald das Finest-Sheet steht,
 * hier 1:1 dessen Kopfzeilen eintragen. Ausführen: node server/project.test.mjs
 */
import assert from 'node:assert/strict';
import { parseSheets } from './parser.js';
import { buildDataset } from './build.js';
import { resolveAdIds } from './adid.js';
import { loadScoringConfig } from './scoring.js';
import { loadProjectConfig, publicProjectConfig } from './project.js';

const PROJECT = loadProjectConfig();
const scoring = loadScoringConfig();

// --- Projekt und Branding ------------------------------------------------------
assert.equal(PROJECT.name, 'Finest Audience', 'Projektname');
assert.equal(PROJECT.slug, 'finest-audience', 'Slug für den CSV-Export');
assert.equal(PROJECT.branding.accent, '#61409d', 'CI-Akzent Lila');
assert.equal(PROJECT.branding.background, '#0a0a0a', 'Schwarz als Grundton');
assert.equal(PROJECT.branding.logo, '/logo.png', 'FA-Logo');
assert.equal(PROJECT.branding.loaderMark, '/fa-mark.png', 'FA-Signet im Ladescreen');
assert.deepEqual(PROJECT.features, { hasTickets: false, hasQuality: false, hasAppointments: true }, 'Leads + Setting Calls');
assert.deepEqual(PROJECT.scope.landingPages, ['finest-audience.com/neukunden', 'finest-audience.com/landingpage-vorlage'], 'beide Funnels im Scope');
assert.deepEqual(publicProjectConfig(PROJECT).answers, {}, 'kein Fragebogen im Frontend');

// --- Kopfzeilen 1:1 aus "Tracking Sheet_Finest Audience" --------------------------
// Schema der Meta-Anzeigen: utm_source={{adset.name}} utm_medium={{ad.name}}
// utm_campaign={{campaign.name}} utm_term={{ad.id}}. Werte aus den ersten echten Leads.
const CAMPAIGN_FREEBIE = 'Funnel Vorlagen | ABO Leads | 03.11.2026';
const CAMPAIGN_VSL = 'Neukunden VSL | ABO Leads | 03.11.2026';
const ADSET_FV = 'AG1: Funnel Vorlagen | DACH Broad | MW 25-55 | 031126';
const ADSET = 'AG1: Neukunden VSL | DACH Broad | MW 25-55 | 031126';
const AD_VSL = 'AG1 ABO VSL | Ad01_H2_B301026_F';
const AD_FV = 'AG1 FV ABO C2 | FV Umsatzrekorde';
const ID_VSL = '120251112855380214';
const ID_FV = '120251113443110214';
const LEAD_HEAD = ['Datum', 'Name', 'E-Mail', 'Telefon ', 'UTM Source', 'UTM Medium', 'UTM  Campaign', 'UTM Term', 'Funnel'];

const vslSheet = {
  title: 'VSL Leads',
  values: [
    LEAD_HEAD,
    ['2026-11-03 18:40:18 +0000', 'Jonas', 'jonas@example.com', '491700000001', ADSET, AD_VSL, CAMPAIGN_VSL, ID_VSL, 'finest-audience.com/neukunden'],
    // ohne Ad-ID: Zuordnung allein über die UTM-Namen
    ['2026-11-03 19:15:00 +0000', 'Sara', 'sara@example.com', '491700000002', ADSET, AD_VSL, CAMPAIGN_VSL, '', 'finest-audience.com/neukunden'],
  ],
};
const freebieSheet = {
  title: 'Funnel Vorlagen Leads',
  values: [
    LEAD_HEAD,
    ['2026-11-03 18:57:31 +0000', 'Lena', 'lena@example.com', '+491700000003', ADSET_FV, AD_FV, CAMPAIGN_FREEBIE, ID_FV, 'finest-audience.com/landingpage-vorlage'],
    // ohne UTMs (Direkt-Eintrag) -> organisch
    ['2026-11-03 20:49:46 +0000', 'Mia', 'mia@example.com', '+491700000004', '', '', '', '', 'finest-audience.com/landingpage-vorlage'],
  ],
};
const settingSheet = {
  title: 'Setting Calls',
  values: [
    ['Datum', 'Vorname', 'Nachname', 'E-Mail', 'Telefon ', 'Branche', 'Beschäftigungsverhältnis', 'Umsatz', 'Datum Setting Call', 'Name Setter', 'UTM Source', 'UTM Medium', 'UTM  Campaign', 'UTM Term', 'UTM Content', 'Quelle'],
    ['2026-11-01 14:00:00', 'Jonas', 'Berg', 'jonas@example.com', '491700000001', 'Coach/Berater/Trainer', 'Selbstständig/Unternehmer', 'Mehr als 100.000 € pro Monat', '2026-11-03 11:00:00', 'Jan Ortmueller', ADSET, AD_VSL, CAMPAIGN_VSL, ID_VSL, '', 'PUBLIC_SCHEDULER'],
  ],
};
// Diese Tabs darf keine Regel als Leads oder Termine lesen
const closingCalls = {
  title: 'Closing Calls',
  values: [
    ['Datum', 'Vorname', 'Nachname', 'E-Mail', 'Telefon ', 'Branche', 'Beschäftigungsverhältnis', 'Umsatz', 'Datum Closing Call', 'Name Closer', 'UTM Source', 'UTM Medium', 'UTM  Campaign', 'UTM Term', 'Quelle'],
    ['2026-11-02 19:12:45', 'Jonas', 'Berg', 'jonas@example.com', '491700000001', '', '', '', '2026-11-04 11:00:00', 'Jan Ortmueller', 'fb', 'paid', CAMPAIGN_VSL, ADSET, 'PUBLIC_SCHEDULER'],
  ],
};
const closings = {
  title: 'Closings',
  values: [
    ['Datum', 'Vorname', 'Nachname', 'E-Mail', 'Telefon ', 'Datum Close', 'Laufzeit', 'Produkt', 'Zahlung', 'Setter', 'Closer', 'UTM Source', 'UTM Medium', 'UTM  Campaign', 'UTM Term'],
    ['2026-11-05', 'Jonas', 'Berg', 'jonas@example.com', '', '2026-11-05', '4 Monate', 'Finest Empire Kurs', '1.998,00 €', 'Jan', 'Jan', 'fb', 'paid', CAMPAIGN_VSL, ADSET],
  ],
};
const produkte = {
  title: 'Produkte',
  values: [
    ['Stufe', 'Produkt', 'Digistore-ID', 'Preis netto', 'Gesamt netto', 'Laufzeit'],
    ['Stufe 1', 'Finest Empire Kurs', '614297', '1.998,00 €', '1.998,00 €', '4 Monate'],
  ],
};

const tabs = [vslSheet, freebieSheet, settingSheet, closingCalls, closings, produkte, { title: 'Funnels', values: [] }];
const parsed = parseSheets(tabs, PROJECT.sheet, PROJECT.features);
assert.equal(parsed.leads.length, 4, 'Leads nur aus den zwei Lead-Tabs');
assert.equal(parsed.tickets.length, 0, 'keine Tickets');
assert.equal(parsed.overview.length, 0, 'keine Adspend-Übersicht im Sheet');
assert.equal(parsed.appointments.length, 1, 'Setting Calls als Termine, Closing Calls zählt nicht');
assert.equal(parsed.leads[0].wonAt, '2026-11-03T18:40:18.000Z', 'Datum mit +0000 gelesen');
assert.equal(parsed.leads[0].adId, ID_VSL, 'Ad-ID aus UTM Term');
assert.equal(parsed.leads[1].adId, '', 'leere UTM Term -> keine Ad-ID');
assert.equal(parsed.appointments[0].adId, ID_VSL, 'Ad-ID im Setting Call');
assert.equal(parsed.leads[0].firstName, 'Jonas', 'Name aus Spalte "Name"');
assert.equal(parsed.appointments[0].callAt, '2026-11-03T11:00:00.000Z', 'Datum Setting Call');
assert.equal(parsed.appointments[0].closer, 'Jan Ortmueller', 'Setter aus "Name Setter"');

const ds = buildDataset(parsed, scoring, PROJECT.features, PROJECT.sheet.utmRoles);
const byMail = (mail) => ds.leads.find((l) => l.email === mail);
assert.equal(ds.counts.leads, 4, 'so viele Leads wie Zeilen in den Lead-Tabs');
assert.equal(ds.counts.tickets, 0, 'keine Ticket-Zählung');
assert.equal(ds.counts.appointments, 1, 'ein Setting Call');

const sara = byMail('sara@example.com');
assert.equal(sara.sourceType, 'paid', 'Pipe-Namensschema -> bezahlt');
assert.equal(sara.campaign, CAMPAIGN_VSL, 'Kampagne aus "UTM  Campaign" (doppeltes Leerzeichen)');
assert.equal(sara.adset, ADSET, 'Anzeigengruppe aus "UTM Source"');
assert.equal(sara.creative, AD_VSL, 'Creative aus "UTM Medium"');
assert.equal(byMail('jonas@example.com').sourceType, 'paid', 'Ad-ID -> bezahlt');
assert.equal(byMail('lena@example.com').campaign, CAMPAIGN_FREEBIE, 'Freebie-Lead der Freebie-Kampagne zugeordnet');
assert.equal(byMail('mia@example.com').sourceType, 'organic', 'ohne UTMs -> organisch');

// --- Ad-ID aus UTM Term gewinnt gegen die UTM-Namen ------------------------------
const meta = {
  adList: [
    { id: ID_VSL, name: 'Ad01_H2_B301026_F', adset: ADSET, campaign: CAMPAIGN_VSL },
    { id: ID_FV, name: 'FV Umsatzrekorde', adset: ADSET_FV, campaign: CAMPAIGN_FREEBIE },
  ],
  entities: [],
};
const stats = resolveAdIds(ds.leads, meta);
assert.equal(stats.resolved, 2, 'zwei Leads über die Ad-ID aufgelöst');
assert.equal(byMail('jonas@example.com').creative, 'Ad01_H2_B301026_F', 'Creative 1:1 aus Meta');
assert.equal(byMail('lena@example.com').adset, ADSET_FV, 'Anzeigengruppe aus Meta');


console.log('✓ Projekt-Konfiguration passt');
console.log(`  ${PROJECT.name} | Akzent ${PROJECT.branding.accent} | Leads: ${ds.counts.leads} (VSL + Funnel Vorlagen), Setting Calls: ${ds.counts.appointments}`);
