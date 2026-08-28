/**
 * Spike deel 2. De eerste ronde liet zien dat de prijsbron werkt maar dat
 * `availability` 409 geeft, dus vertrektijden moeten uit `timtbl/schedules` komen.
 * Die gaf HTTP 200 met bruikbare body; mijn extractor had er alleen geen branch
 * voor. Dit script beantwoordt de twee vragen die daaruit volgen:
 *
 *   1. Levert schedules tijden voor alle 8 gedekte routes, in BEIDE richtingen
 *      (heen op wedstrijddag, terug de dag erna) en ook in het winterschema?
 *
 *   2. Hoeveel rotaties per dag? cheapestPerDay geeft één prijs per dag, niet per
 *      vlucht. Bij één rotatie hoort die prijs eenduidig bij die vlucht. Bij twee
 *      of meer weten we niet bij welke, en dan mag de tool geen vertrektijd aan
 *      een prijs koppelen zonder dat te melden.
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// Alleen de routes die in ronde 1 prijzen gaven.
const COVERED = [
  ['EIN', 'OPO'], ['NRN', 'OPO'], ['BRU', 'OPO'], ['CRL', 'OPO'], ['CGN', 'OPO'],
  ['EIN', 'MAD'], ['BRU', 'MAD'], ['CRL', 'MAD'],
];

const PERIODS = [
  { label: 'sept', year: 2026, month: 9 },
  { label: 'jan',  year: 2027, month: 1 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function schedules(orig, dest, year, month) {
  const url = `https://services-api.ryanair.com/timtbl/3/schedules/${orig}/${dest}/years/${year}/months/${month}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { status: res.status, days: [] };
    const json = await res.json();
    const days = (json?.days ?? []).map((d) => ({
      day: d.day,
      flights: (d.flights ?? []).map((f) => ({
        carrier: f.carrierCode, number: f.number,
        dep: f.departureTime, arr: f.arrivalTime,
      })),
    })).filter((d) => d.flights.length > 0);
    return { status: res.status, days };
  } catch (err) {
    return { status: 0, days: [], error: `${err.name}: ${err.message}` };
  }
}

function summarise(days) {
  const counts = days.map((d) => d.flights.length);
  const multi = counts.filter((c) => c > 1).length;
  const firstDeps = days
    .map((d) => d.flights.map((f) => f.dep).sort()[0])
    .filter(Boolean)
    .sort();
  return {
    dagenMetVlucht: days.length,
    dagenMetMeerdereRotaties: multi,
    vroegsteVertrekOoit: firstDeps[0] ?? '-',
    laatsteVroegsteVertrek: firstDeps[firstDeps.length - 1] ?? '-',
  };
}

async function main() {
  console.log(`Schedules-spike ${new Date().toISOString()}\n`);
  const report = [];

  for (const [orig, dest] of COVERED) {
    for (const p of PERIODS) {
      // Heen: orig -> dest. Terug: dest -> orig, want het reismodel vliegt
      // de dag na de wedstrijd naar huis.
      const heen = await schedules(orig, dest, p.year, p.month);
      await sleep(350);
      const terug = await schedules(dest, orig, p.year, p.month);
      await sleep(350);

      const h = summarise(heen.days);
      const t = summarise(terug.days);
      report.push({ route: `${orig}-${dest}`, periode: p.label, heen: h, terug: t,
                    statusHeen: heen.status, statusTerug: terug.status });

      console.log(
        `${orig}-${dest} ${p.label.padEnd(5)} ` +
        `heen: ${String(h.dagenMetVlucht).padStart(2)}d ` +
        `(${h.dagenMetMeerdereRotaties} met >1 rotatie, vroegste ${h.vroegsteVertrekOoit}) ` +
        `| terug: ${String(t.dagenMetVlucht).padStart(2)}d ` +
        `(${t.dagenMetMeerdereRotaties} met >1, vroegste ${t.vroegsteVertrekOoit}) ` +
        `[${heen.status}/${terug.status}]`
      );
    }
  }

  // De vraag die het hele reismodel maakt of breekt: kun je op wedstrijddag
  // 's ochtends heen? Toon per route elke vertrektijd die in september voorkomt.
  console.log(`\n${'='.repeat(72)}`);
  console.log('VERTREKTIJDEN HEEN, september 2026 — kan het model "ochtendvlucht" wel?');
  console.log('='.repeat(72));
  for (const [orig, dest] of COVERED) {
    const s = await schedules(orig, dest, 2026, 9);
    await sleep(350);
    const times = [...new Set(s.days.flatMap((d) => d.flights.map((f) => f.dep)))].sort();
    const ochtend = times.filter((t) => t < '11:00');
    console.log(`  ${orig}-${dest}: ${times.join(', ') || 'geen'}`);
    console.log(`      ochtendvertrek (<11:00): ${ochtend.join(', ') || 'GEEN — model onhaalbaar op deze route'}`);
  }

  console.log(`\n--- machineleesbaar ---\n${JSON.stringify(report, null, 2)}`);
}

main().catch((e) => { console.error('Spike gecrasht:', e); process.exit(1); });
