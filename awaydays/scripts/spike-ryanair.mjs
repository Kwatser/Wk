/**
 * Spike (stap 0 uit het plan): is de gratis Ryanair-data bruikbaar vanaf een
 * GitHub Actions runner?
 *
 * Beantwoordt drie vragen, in deze volgorde:
 *   1. Bereikbaarheid  — welke endpointvormen antwoorden uberhaupt vanaf dit IP?
 *   2. Dekking         — voor hoeveel van de 13 routes komt er een prijs terug?
 *   3. Vertrektijden   — krijgen we tijden, of alleen prijzen? Zonder tijden kan
 *                        de 3-uursregel uit het plan niet gehandhaafd worden.
 *
 * Beslisregel R1: >= 8 van de 13 routes gedekt -> gratis route.
 * Minder -> SerpApi Starter.
 *
 * Geen dependencies: Node 20+ heeft fetch ingebouwd.
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// De 13 routes uit het plan. Ryanair vliegt lang niet allemaal — dat is precies
// wat we willen meten, niet aannemen.
const ROUTES = [
  ['EIN', 'OPO'], ['NRN', 'OPO'], ['DUS', 'OPO'], ['AMS', 'OPO'],
  ['BRU', 'OPO'], ['CRL', 'OPO'], ['CGN', 'OPO'],
  ['EIN', 'MAD'], ['NRN', 'MAD'], ['DUS', 'MAD'], ['AMS', 'MAD'],
  ['BRU', 'MAD'], ['CRL', 'MAD'],
];

// Een speelronde-1 datum (zomerschema) en een speelronde-8 datum (winterschema).
// Winter apart testen omdat frequenties daar instorten — openstaande actie 4.
const SEPT = { from: '2026-09-08', to: '2026-09-10', month: '2026-09-01' };
const JAN  = { from: '2027-01-27', to: '2027-01-27', month: '2027-01-01' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(label, url) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.text();
    const ms = Date.now() - started;
    let json = null;
    try { json = JSON.parse(body); } catch { /* geen JSON: laat null */ }
    return { label, url, status: res.status, ok: res.ok, ms, json, raw: body.slice(0, 300) };
  } catch (err) {
    return {
      label, url, status: 0, ok: false, ms: Date.now() - started,
      json: null, raw: `FETCH FAILED: ${err.name}: ${err.message}`,
    };
  }
}

/* ---------- Endpointvormen. Ik weet niet welke nog leeft; dat is de spike. ---------- */

const shapes = {
  cheapestPerDay: (o, d, w) =>
    `https://services-api.ryanair.com/farfnd/v4/oneWayFares/${o}/${d}/cheapestPerDay` +
    `?outboundMonthOfDate=${w.month}&currency=EUR`,

  oneWayFares: (o, d, w) =>
    'https://services-api.ryanair.com/farfnd/v4/oneWayFares' +
    `?departureAirportIataCode=${o}&arrivalAirportIataCode=${d}` +
    `&outboundDepartureDateFrom=${w.from}&outboundDepartureDateTo=${w.to}` +
    '&currency=EUR&limit=20&market=nl-nl',

  availability: (o, d, w) =>
    'https://www.ryanair.com/api/booking/v4/nl-nl/availability' +
    `?ADT=1&CHD=0&INF=0&TEEN=0&Origin=${o}&Destination=${d}` +
    `&DateOut=${w.from}&FlexDaysOut=2&FlexDaysBeforeOut=0&RoundTrip=false` +
    '&ToUs=AGREED&IncludeConnectingFlights=false',

  schedules: (o, d) =>
    `https://services-api.ryanair.com/timtbl/3/schedules/${o}/${d}/years/2026/months/9`,
};

/* ---------- Prijzen uit een respons peuteren, per vorm ---------- */

function extractFares(shape, json) {
  if (!json) return [];
  try {
    if (shape === 'cheapestPerDay') {
      const days = json?.outbound?.fares ?? [];
      return days
        .filter((f) => f && f.unavailable !== true && f.price)
        .map((f) => ({ date: f.day, price: f.price.value, currency: f.price.currencyCode }));
    }
    if (shape === 'oneWayFares') {
      const fares = json?.fares ?? [];
      return fares.map((f) => ({
        date: f?.outbound?.departureDate,
        price: f?.outbound?.price?.value,
        currency: f?.outbound?.price?.currencyCode,
      }));
    }
    if (shape === 'availability') {
      const out = [];
      for (const t of json?.trips ?? []) {
        for (const d of t?.dates ?? []) {
          for (const f of d?.flights ?? []) {
            out.push({
              date: d.dateOut,
              depart: f?.timeUTC?.[0] ?? f?.time?.[0],
              arrive: f?.timeUTC?.[1] ?? f?.time?.[1],
              price: f?.regularFare?.fares?.[0]?.amount ?? null,
              seats: f?.faresLeft ?? null,
            });
          }
        }
      }
      return out;
    }
  } catch (err) {
    console.log(`    ! parsefout voor ${shape}: ${err.message}`);
  }
  return [];
}

/* ---------- Fase 1: bereikbaarheid ---------- */

async function phase1() {
  console.log('='.repeat(72));
  console.log('FASE 1 — Bereikbaarheid vanaf deze runner');
  console.log('='.repeat(72));

  const results = {};
  const probes = [
    ['cheapestPerDay', shapes.cheapestPerDay('EIN', 'OPO', SEPT)],
    ['oneWayFares',    shapes.oneWayFares('EIN', 'OPO', SEPT)],
    ['availability',   shapes.availability('EIN', 'OPO', SEPT)],
    ['schedules',      shapes.schedules('EIN', 'OPO')],
  ];

  for (const [label, url] of probes) {
    const r = await probe(label, url);
    results[label] = r;
    const fares = extractFares(label, r.json);
    console.log(`\n[${label}] HTTP ${r.status} in ${r.ms}ms`);
    console.log(`  ${r.url}`);
    if (r.ok) {
      console.log(`  bruikbare records: ${fares.length}`);
      if (fares.length) console.log(`  voorbeeld: ${JSON.stringify(fares[0])}`);
      else console.log(`  body begint met: ${r.raw.slice(0, 160)}`);
    } else {
      console.log(`  MISLUKT: ${r.raw.slice(0, 200)}`);
    }
    await sleep(400);
  }
  return results;
}

/* ---------- Fase 2: dekking over alle 13 routes ---------- */

async function phase2(shape) {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`FASE 2 — Dekking over 13 routes via "${shape}"`);
  console.log('='.repeat(72));

  const table = [];
  for (const [orig, dest] of ROUTES) {
    const sep = await probe(shape, shapes[shape](orig, dest, SEPT));
    await sleep(400);
    const jan = await probe(shape, shapes[shape](orig, dest, JAN));
    await sleep(400);

    const sf = extractFares(shape, sep.json);
    const jf = extractFares(shape, jan.json);
    const cheapest = sf.filter((f) => f.price != null).sort((a, b) => a.price - b.price)[0];

    table.push({
      route: `${orig}-${dest}`,
      sept: sf.length, jan: jf.length,
      septStatus: sep.status, janStatus: jan.status,
      cheapest: cheapest ? `EUR ${cheapest.price} op ${cheapest.date}` : '-',
    });
    console.log(
      `  ${orig}-${dest}  sept:${String(sf.length).padStart(3)} (${sep.status})  ` +
      `jan:${String(jf.length).padStart(3)} (${jan.status})  ${cheapest ? `vanaf EUR ${cheapest.price}` : 'geen fares'}`
    );
  }
  return table;
}

/* ---------- Fase 3: tijden ---------- */

async function phase3() {
  console.log(`\n${'='.repeat(72)}`);
  console.log('FASE 3 — Vertrek- en aankomsttijden (nodig voor de 3-uursregel)');
  console.log('='.repeat(72));

  for (const [orig, dest] of [['EIN', 'OPO'], ['CRL', 'MAD']]) {
    const r = await probe('availability', shapes.availability(orig, dest, SEPT));
    const flights = extractFares('availability', r.json);
    console.log(`\n  ${orig}-${dest}: HTTP ${r.status}, ${flights.length} vluchten`);
    flights.slice(0, 5).forEach((f) =>
      console.log(`    ${f.date} ${f.depart} -> ${f.arrive}  EUR ${f.price}  stoelen:${f.seats}`)
    );
    if (!flights.length && r.ok) console.log(`    body: ${r.raw.slice(0, 200)}`);
    await sleep(400);
  }
}

/* ---------- Verdict ---------- */

async function main() {
  console.log(`Spike gestart ${new Date().toISOString()}`);
  console.log(`Node ${process.version}\n`);

  const reach = await phase1();

  const priceShapes = ['cheapestPerDay', 'oneWayFares'];
  const working = priceShapes.find(
    (s) => reach[s]?.ok && extractFares(s, reach[s].json).length > 0
  );

  let table = [];
  if (working) {
    table = await phase2(working);
    await phase3();
  } else {
    console.log('\nGeen enkele prijsvorm gaf bruikbare data. Fase 2 en 3 overgeslagen.');
    if (reach.availability?.ok) {
      console.log('availability antwoordde wel — die kan als noodbron dienen.');
      await phase3();
    }
  }

  const covered = table.filter((r) => r.sept > 0 || r.jan > 0);

  console.log(`\n${'='.repeat(72)}`);
  console.log('VERDICT (beslisregel R1: >= 8 van 13 routes gedekt)');
  console.log('='.repeat(72));
  console.log(`  werkende prijsvorm : ${working ?? 'GEEN'}`);
  console.log(`  routes met prijzen : ${covered.length} van ${ROUTES.length}`);
  if (covered.length) console.log(`  gedekt             : ${covered.map((r) => r.route).join(', ')}`);
  const missing = table.filter((r) => r.sept === 0 && r.jan === 0).map((r) => r.route);
  if (missing.length) console.log(`  niet gedekt        : ${missing.join(', ')}`);
  console.log(`\n  UITKOMST: ${covered.length >= 8 ? 'GRATIS ROUTE HOUDBAAR' : 'SCHAKEL OVER OP SERPAPI ($25)'}`);

  console.log(`\n--- machineleesbaar ---\n${JSON.stringify(
    { working: working ?? null, covered: covered.length, total: ROUTES.length, table }, null, 2
  )}`);
}

main().catch((e) => { console.error('Spike zelf gecrasht:', e); process.exit(1); });
