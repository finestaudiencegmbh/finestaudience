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
assert.deepEqual(PROJECT.features, { hasTickets: false, hasQuality: false, hasAppointments: false }, 'reines Lead-Dashboard');
assert.deepEqual(publicProjectConfig(PROJECT).answers, {}, 'kein Fragebogen im Frontend');

// --- Zwei Funnels, je ein Lead-Tab ----------------------------------------------
//   utm_source={{adset.name}} utm_medium={{ad.name}} utm_campaign={{campaign.name}}
//   utm_term={{placement}} ad_id={{ad.id}}
const CAMPAIGN_FREEBIE = 'FA | Landingpage-Vorlagen | Leads | ABO';
const CAMPAIGN_VSL = 'FA | Neukunden-VSL | Leads | ABO';
const ADSET = '01.11. | broad';
const HEAD = ['Eingetragen am', 'Vorname', 'Nachname', 'E-Mail', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ad_id'];

const freebieSheet = {
  title: 'Landingpage-Vorlagen OptIns',
  values: [
    HEAD,
    ['3', '', '', '', '', '', '', '', '', ''], // Zählzeile (=COUNTA) wird ignoriert
    ['2026-11-01 09:12:00', 'Lena', 'Kraus', 'lena@example.com', ADSET, 'Vorlagen Hook 1', CAMPAIGN_FREEBIE, '', 'Instagram_Reels', '120210000000000001'],
    ['2026-11-01 10:40:00', 'Tom', 'Weber', 'tom@example.com', ADSET, 'Vorlagen Hook 2', CAMPAIGN_FREEBIE, '', 'Facebook_Mobile_Feed', ''],
    ['2026-11-01 11:05:00', 'Mia', 'Hahn', 'mia@example.com', 'newsletter', 'email', 'newsletter-11-26', '', '', ''],
  ],
};

const vslSheet = {
  title: 'Neukunden-VSL OptIns',
  values: [
    HEAD,
    ['2026-11-01 12:30:00', 'Jonas', 'Berg', 'jonas@example.com', ADSET, 'VSL Testimonial', CAMPAIGN_VSL, '', 'Instagram_Stories', '120210000000000002'],
    ['2026-11-01 13:15:00', 'Sara', 'Lang', 'sara@example.com', ADSET, 'VSL Testimonial', CAMPAIGN_VSL, '', 'Instagram_Feed', ''],
  ],
};

// Termin-Tab ist da, aber abgeschaltet: darf nichts zählen
const appointmentSheet = {
  title: 'Termine',
  values: [
    ['Datum', 'Name', 'E-Mail', 'Telefonnummer', 'Datum Call', 'utm_source', 'utm_medium', 'utm_campaign'],
    ['2026-11-01', 'Jonas Berg', 'jonas@example.com', '+4917300000', '2026-11-03 10:00', ADSET, 'VSL Testimonial', CAMPAIGN_VSL],
  ],
};

const parsed = parseSheets([freebieSheet, vslSheet, appointmentSheet], PROJECT.sheet, PROJECT.features);
assert.equal(parsed.leads.length, 5, 'Leads aus beiden Funnel-Tabs, Zählzeile ignoriert');
assert.equal(parsed.tickets.length, 0, 'keine Tickets');
assert.equal((parsed.appointments || []).length, 0, 'Termin-Tab wird ohne hasAppointments nicht gelesen');
assert.equal(parsed.leads[0].adId, '120210000000000001', 'Ad-ID aus dem Lead-Tab');

const ds = buildDataset(parsed, scoring, PROJECT.features, PROJECT.sheet.utmRoles);
const byMail = (mail) => ds.leads.find((l) => l.email === mail);
assert.equal(ds.counts.leads, 5, 'so viele Leads wie Zeilen in den Lead-Tabs');
assert.equal(ds.counts.tickets, 0, 'keine Ticket-Zählung');

const sara = byMail('sara@example.com');
assert.equal(sara.sourceType, 'paid', 'Pipe-Namensschema -> bezahlt');
assert.equal(sara.campaign, CAMPAIGN_VSL, 'Kampagne aus utm_campaign');
assert.equal(sara.adset, ADSET, 'Anzeigengruppe aus utm_source');
assert.equal(sara.creative, 'VSL Testimonial', 'Creative aus utm_medium');
assert.equal(sara.placement, 'Instagram Feed', 'Placement aus utm_term');
assert.equal(byMail('tom@example.com').campaign, CAMPAIGN_FREEBIE, 'Freebie-Lead der Freebie-Kampagne zugeordnet');
assert.equal(byMail('mia@example.com').sourceType, 'organic', 'Newsletter -> organisch');

// --- Ad-ID gewinnt gegen die UTM-Namen -------------------------------------------
const meta = {
  adList: [
    { id: '120210000000000001', name: 'Vorlagen Hook 1 | v2', adset: '01.11. | broad |', campaign: CAMPAIGN_FREEBIE },
    { id: '120210000000000002', name: 'VSL Testimonial | v1', adset: '01.11. | broad |', campaign: CAMPAIGN_VSL },
  ],
  entities: [],
};
const stats = resolveAdIds(ds.leads, meta);
assert.equal(stats.resolved, 2, 'zwei Leads über die Ad-ID aufgelöst');
assert.equal(byMail('lena@example.com').creative, 'Vorlagen Hook 1 | v2', 'Creative aus Meta statt aus utm_medium');
assert.equal(byMail('jonas@example.com').adset, '01.11. | broad |', 'Anzeigengruppe aus Meta statt aus utm_source');

console.log('✓ Projekt-Konfiguration passt');
console.log(`  ${PROJECT.name} | Akzent ${PROJECT.branding.accent} | Leads: ${ds.counts.leads} (Landingpage-Vorlagen + Neukunden-VSL), ohne Tickets/Quali/Termine`);
