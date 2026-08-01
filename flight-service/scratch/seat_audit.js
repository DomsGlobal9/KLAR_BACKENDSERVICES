/**
 * Seat Audit Script
 * ---------------------------------------------------
 * 1. Searches DEL → BOM (14 days from now)
 * 2. Takes up to 20 flights from response.data.flights[]
 * 3. For each: /fare/oneway → fareId → /review → bookingId → /seat
 * 4. Prints full report: seat count, free/paid/unavailable per flight
 */

const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'localhost',
      port: 5011,
      path: `/api/flight${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Deep-search for a key in an object
function findKey(obj, key, depth = 0) {
  if (depth > 5) return undefined;
  if (obj && typeof obj === 'object') {
    if (obj[key] !== undefined) return obj[key];
    for (const v of Object.values(obj)) {
      const found = findKey(v, key, depth + 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

async function main() {
  // ── Step 1: Search ───────────────────────────────────────────────────────
  const d = new Date();
  d.setDate(d.getDate() + 14);
  // Tripjack date format: DDMMYYYY
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const travelDate = `${dd}${mm}${yyyy}`;

  console.log(`\n🔍 Searching DEL→BOM for ${dd}/${mm}/${yyyy}...\n`);

  // travelDate format the validator wants: YYYY-MM-DD
  const isoDate = `${yyyy}-${mm}-${dd}`;

  const searchPayload = {
    cabinClass: "ECONOMY",
    paxInfo: { ADULT: 1, CHILD: 0, INFANT: 0 },
    routeInfos: [
      {
        fromCityOrAirport: { code: "DEL" },
        toCityOrAirport: { code: "BOM" },
        travelDate: isoDate
      }
    ],
    searchModifiers: {
      isDirectFlight: false,
      isConnectFlight: false
    }
  };

  const searchRes = await post('/search/oneway', searchPayload);

  if (searchRes.status !== 200 || !searchRes.body.success) {
    console.error('❌ Search failed:');
    console.error(JSON.stringify(searchRes.body, null, 2));
    process.exit(1);
  }

  // Search response: { success, data: { sessionId, flights: [], airlineStats } }
  const sessionId = searchRes.body.data?.sessionId;
  const flights = searchRes.body.data?.flights || [];

  if (!flights.length) {
    console.error('❌ No flights returned. Keys:', Object.keys(searchRes.body.data || {}));
    process.exit(1);
  }

  console.log(`✅ Found ${flights.length} flights | sessionId: ${sessionId}\n`);
  console.log(`Testing first ${Math.min(20, flights.length)} flights...\n`);

  const testFlights = flights.slice(0, 20);
  const results = [];

  // ── Step 2: For each flight ───────────────────────────────────────────────
  for (let i = 0; i < testFlights.length; i++) {
    const flight = testFlights[i];
    const flightKey = flight.flightKey;
    const label = `${flight.flightNumber || flight.airline} (${flight.from?.airportCode}→${flight.to?.airportCode})`;

    process.stdout.write(`\n[${String(i+1).padStart(2)}/${testFlights.length}] ${label}\n`);
    process.stdout.write(`      flightKey: ${flightKey}\n`);

    if (!sessionId || !flightKey) {
      console.log('      ⚠️  Missing sessionId or flightKey – skip');
      results.push({ label, note: 'no session/key' });
      continue;
    }

    await sleep(400);

    // ── 2a: Fare ─────────────────────────────────────────────────────────
    let fareId;
    const fareRes = await post('/fare/oneway', { sessionId, flightKey });
    if (fareRes.status === 200 && fareRes.body.success) {
      // fareId can be at different depths depending on backend version
      fareId = findKey(fareRes.body.data, 'fareId');
      process.stdout.write(`      fare: ${fareId ? '✅ ' + fareId : '❌ fareId not found in response'}\n`);
    } else {
      process.stdout.write(`      fare: ❌ HTTP ${fareRes.status} – ${JSON.stringify(fareRes.body).substring(0, 80)}\n`);
    }

    if (!fareId) {
      results.push({ label, note: 'fare failed' });
      continue;
    }

    await sleep(400);

    // ── 2b: Review ───────────────────────────────────────────────────────
    let bookingId;
    const reviewRes = await post('/review', { priceIds: [fareId] });
    if (reviewRes.status === 200 && reviewRes.body.success) {
      bookingId = findKey(reviewRes.body.data, 'bookingId');
      process.stdout.write(`      review: ${bookingId ? '✅ ' + bookingId : '❌ bookingId not found'}\n`);
    } else {
      process.stdout.write(`      review: ❌ HTTP ${reviewRes.status} – ${JSON.stringify(reviewRes.body).substring(0, 80)}\n`);
    }

    if (!bookingId) {
      results.push({ label, note: 'review failed', fareId });
      continue;
    }

    await sleep(400);

    // ── 2c: Seat ─────────────────────────────────────────────────────────
    const seatRes = await post('/seat', { bookingId });
    if (seatRes.status === 200 && seatRes.body.success) {
      const tripSeat = seatRes.body.data?.tripSeatMap?.tripSeat;
      
      let total = 0, free = 0, paid = 0, unavail = 0;
      let segKeys = [];

      if (tripSeat && typeof tripSeat === 'object') {
        segKeys = Object.keys(tripSeat);
        for (const segKey of segKeys) {
          const sInfo = tripSeat[segKey]?.sInfo;
          if (Array.isArray(sInfo)) {
            for (const s of sInfo) {
              total++;
              if (s.isBooked === true) { unavail++; }
              else if ((s.amount ?? 0) === 0) { free++; }
              else { paid++; }
            }
          }
        }
      }

      process.stdout.write(`      seat: ✅ ${total} seats across ${segKeys.length} segment(s)\n`);
      process.stdout.write(`            Free=${free} | Paid=${paid} | Unavail=${unavail} | Segs: [${segKeys.join(', ')}]\n`);

      results.push({
        label, total, free, paid, unavail,
        segments: segKeys.length, segKeys,
        note: total > 0 ? '✅ has seats' : '⚠️  empty map'
      });
    } else {
      process.stdout.write(`      seat: ❌ HTTP ${seatRes.status} – ${JSON.stringify(seatRes.body).substring(0, 80)}\n`);
      results.push({ label, note: 'seat API failed', fareId, bookingId });
    }

    await sleep(600);
  }

  // ── Step 3: Final Report ──────────────────────────────────────────────────
  console.log('\n\n════════════════════════════════════════════════════════════════');
  console.log('                       SEAT AUDIT REPORT');
  console.log('════════════════════════════════════════════════════════════════');

  const withSeats = results.filter(r => r.total > 0);
  const noSeats   = results.filter(r => !r.total);

  console.log(`\nTotal tested : ${results.length}`);
  console.log(`Has seat map : ${withSeats.length} ✅`);
  console.log(`No seat map  : ${noSeats.length} ⚠️`);

  if (withSeats.length > 1) {
    const allSameTotal = withSeats.every(r => r.total === withSeats[0].total && r.free === withSeats[0].free);
    console.log(`\nSeat maps are: ${allSameTotal
      ? '⚠️  IDENTICAL across flights (possible caching bug!)'
      : '✅ DIFFERENT per flight (correct dynamic behaviour)'}`);
  }

  console.log('\n┌────┬──────────────────────────────┬───────┬──────┬──────┬────────┬─────────────┐');
  console.log('│ #  │ Flight                       │ Total │ Free │ Paid │ Unavil │ Note        │');
  console.log('├────┼──────────────────────────────┼───────┼──────┼──────┼────────┼─────────────┤');

  results.forEach((r, i) => {
    const num   = String(i + 1).padStart(2);
    const fl    = (r.label || '').padEnd(28).substring(0, 28);
    const tot   = String(r.total ?? '-').padStart(5);
    const fr    = String(r.free ?? '-').padStart(4);
    const pd    = String(r.paid ?? '-').padStart(4);
    const un    = String(r.unavail ?? '-').padStart(6);
    const nt    = (r.note || '').padEnd(11).substring(0, 11);
    console.log(`│ ${num} │ ${fl} │ ${tot} │ ${fr} │ ${pd} │ ${un} │ ${nt} │`);
  });

  console.log('└────┴──────────────────────────────┴───────┴──────┴──────┴────────┴─────────────┘');

  if (noSeats.length > 0) {
    console.log('\nFlights without seat data:');
    noSeats.forEach(r => console.log(`  ✗ ${r.label}  →  ${r.note}`));
  }
}

main().catch(e => {
  console.error('\n💥 Fatal:', e.message);
  process.exit(1);
});
