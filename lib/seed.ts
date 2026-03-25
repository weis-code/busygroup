import { sql } from './db';
import { randomUUID } from 'crypto';

async function seed() {
  console.log('🌱 Starter seed...');

  // Clear existing data
  await sql`DELETE FROM notes`;
  await sql`DELETE FROM meetings`;
  await sql`DELETE FROM outreach_sequences`;
  await sql`DELETE FROM agent_logs`;
  await sql`DELETE FROM leads`;
  await sql`DELETE FROM agents`;

  // === AGENTS ===
  const agents = [
    { id: 'cso', name: 'CSO Agent', market: 'global', status: 'idle', last_action: 'Genererede ugentlig rapport til ledelsen', runs_today: 1 },
    { id: 'se-prospecting', name: 'SE Prospecting', market: 'sweden', status: 'idle', last_action: 'Fandt 20 nye leads i Stockholm og Göteborg', runs_today: 3 },
    { id: 'se-outreach', name: 'SE Outreach', market: 'sweden', status: 'idle', last_action: 'Sendte 18 LinkedIn DMs til nye leads', runs_today: 2 },
    { id: 'se-followup', name: 'SE Follow-up', market: 'sweden', status: 'idle', last_action: 'Sendte 7 follow-up beskeder (trin 2)', runs_today: 5 },
    { id: 'se-booking', name: 'SE Booking', market: 'sweden', status: 'idle', last_action: 'Bookede møde med Tandläkare Lindqvist AB', runs_today: 2 },
  ];

  const now = new Date();
  for (const agent of agents) {
    const lastRun = new Date(now.getTime() - Math.random() * 3600000 * 8).toISOString();
    await sql`
      INSERT INTO agents (id, name, market, status, last_action, last_run, runs_today)
      VALUES (${agent.id}, ${agent.name}, ${agent.market}, ${agent.status}, ${agent.last_action}, ${lastRun}, ${agent.runs_today})
    `;
  }
  console.log('✅ Agents indsat');

  // === SWEDISH LEADS ===
  const swedishLeads = [
    { company: 'Tandläkare Lindqvist AB', contact_name: 'Erik Lindqvist', contact_title: 'Klinikchef', company_size: '5-10 ansatte', why_they_fit: 'Stor klinik med mange opkald dagligt. Taber omsætning på ubesvarede opkald efter lukketid. AI Receptionist løser dette direkte.', priority: 'high', status: 'interested' },
    { company: 'Göteborg VVS & Rörtjänst', contact_name: 'Marcus Bergström', contact_title: 'Indehaver', company_size: '3-5 ansatte', why_they_fit: 'Håndværksfirma med konstant telefonstress under arbejde. Mister kunder til konkurrenter der svarer hurtigere.', priority: 'high', status: 'booked' },
    { company: 'Klinik för Fysioterapi Stockholm', contact_name: 'Anna Svensson', contact_title: 'Klinikchef', company_size: '8-15 ansatte', why_they_fit: 'Stor klinik med mange bookinger. Bruger stadig manuel aftalebestilling per telefon.', priority: 'high', status: 'replied' },
    { company: 'El-Installatör Johansson', contact_name: 'Lars Johansson', contact_title: 'Indehaver', company_size: '2-4 ansatte', why_they_fit: 'Solo-installatør der mister opkald under el-arbejde. Perfekt match til AI Receptionist.', priority: 'medium', status: 'contacted' },
    { company: 'Psykolog Centrum Malmö', contact_name: 'Sofia Nilsson', contact_title: 'Psykolog / Indehaver', company_size: '3-6 ansatte', why_they_fit: 'Psykologklinik der ikke kan tage opkald under sessioner. Mange ubesvarede opkald.', priority: 'high', status: 'new' },
    { company: 'Snickeri & Bygg Petersson', contact_name: 'Johan Petersson', contact_title: 'Tømrermester', company_size: '4-8 ansatte', why_they_fit: 'Byggefirma med travle sæsoner. Mister tilbudsforespørgsler når de er på byggepladsen.', priority: 'medium', status: 'new' },
    { company: 'Skönhetsklinik Aurora', contact_name: 'Maria Ekström', contact_title: 'Grundlægger', company_size: '2-4 ansatte', why_they_fit: 'Skønhedsklinik med online booking men mange opkald der falder igennem. Høj kundevolumen.', priority: 'high', status: 'contacted' },
    { company: 'Kiropraktor Hansen & Co', contact_name: 'Henrik Hansen', contact_title: 'Kiropraktor', company_size: '3-5 ansatte', why_they_fit: 'Klinik med venteliste. Mister potentielle kunder dagligt pga. ubesvarede telefoner.', priority: 'medium', status: 'replied' },
    { company: 'Malmö Måleri AB', contact_name: 'Andreas Karlsson', contact_title: 'Daglig Leder', company_size: '6-12 ansatte', why_they_fit: 'Malervirksomhed med sæsonpres. Receptionist for dyr for denne størrelse. AI er løsningen.', priority: 'medium', status: 'new' },
    { company: 'Tandvård Göteborg City', contact_name: 'Petra Lindberg', contact_title: 'Klinikkoordinator', company_size: '10-20 ansatte', why_they_fit: 'Stor bytandlæge med høj trafikvolumen. Betalingsvillige og vant til digitale løsninger.', priority: 'high', status: 'won' },
  ];

  const danishLeads = [
    { company: 'Tandlæge Møller & Partnere', contact_name: 'Rasmus Møller', contact_title: 'Tandlæge / Indehaver', company_size: '5-8 ansatte', why_they_fit: 'Stor tandlægeklinik i København med mange daglige opkald. Ideel til AI Receptionist.', priority: 'high', status: 'new', market: 'denmark' },
    { company: 'VVS Larsen Odense', contact_name: 'Thomas Larsen', contact_title: 'VVS Mester', company_size: '4-7 ansatte', why_they_fit: 'VVS firma i Odense med mange akutopkald. Perfekt match til AI Receptionist.', priority: 'medium', status: 'new', market: 'denmark' },
    { company: 'Fysioterapi Centrum Aarhus', contact_name: 'Mette Jensen', contact_title: 'Klinikchef', company_size: '6-12 ansatte', why_they_fit: 'Stor fysioterapiklinik i Aarhus. Betalingsvillig målgruppe.', priority: 'high', status: 'new', market: 'denmark' },
  ];

  const allLeads = [
    ...swedishLeads.map(l => ({ ...l, market: 'sweden' as string })),
    ...danishLeads,
  ];

  const leadIds: Record<string, string> = {};
  for (const lead of allLeads) {
    const id = randomUUID();
    leadIds[lead.company] = id;
    const createdAt = new Date(now.getTime() - Math.random() * 30 * 24 * 3600000).toISOString();
    const updatedAt = new Date(Date.parse(createdAt) + Math.random() * 7 * 24 * 3600000).toISOString();
    const linkedinUrl = `https://linkedin.com/in/${lead.contact_name.toLowerCase().replace(/\s+/g, '-')}`;
    const email = `${lead.contact_name.split(' ')[0].toLowerCase()}@${lead.company.toLowerCase().replace(/\s+/g, '').replace(/[åä]/g, 'a').replace(/[ö]/g, 'o').substring(0, 12)}.se`;

    await sql`
      INSERT INTO leads (id, company, contact_name, contact_title, linkedin_url, email, phone, company_size, why_they_fit, priority, status, market, created_at, updated_at)
      VALUES (${id}, ${lead.company}, ${lead.contact_name}, ${lead.contact_title}, ${linkedinUrl}, ${email}, ${null}, ${lead.company_size}, ${lead.why_they_fit}, ${lead.priority}, ${lead.status}, ${lead.market || 'sweden'}, ${createdAt}, ${updatedAt})
    `;
  }
  console.log('✅ Leads indsat');

  console.log('\n🎉 Seed færdig!');
  await sql.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
