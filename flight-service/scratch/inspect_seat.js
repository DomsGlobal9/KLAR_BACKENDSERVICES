/**
 * Raw Seat Response Inspector
 * Takes one real bookingId from a review and dumps the exact raw seat JSON
 * so we can see what Tripjack actually returns.
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

async function main() {
  // Use known good sessionId + flightKey from last audit run
  // First flight was SG-476 with flightKey: 238 and its fareId was the first one
  // Let's re-search to get fresh ones
  const d = new Date();
  d.setDate(d.getDate() + 14);
  const isoDate = d.toISOString().split('T')[0];

  console.log('Searching...');
  const searchRes = await post('/search/oneway', {
    cabinClass: "ECONOMY",
    paxInfo: { ADULT: 1, CHILD: 0, INFANT: 0 },
    routeInfos: [{ fromCityOrAirport: { code: "DEL" }, toCityOrAirport: { code: "BOM" }, travelDate: isoDate }],
    searchModifiers: { isDirectFlight: false, isConnectFlight: false }
  });

  const sessionId = searchRes.body.data?.sessionId;
  const flights = searchRes.body.data?.flights || [];
  console.log(`Found ${flights.length} flights, sessionId=${sessionId}`);

  // Take first flight
  const f = flights[0];
  const flightKey = f.flightKey;
  console.log(`\nTesting: ${f.flightNumber} flightKey=${flightKey}`);

  // Fare
  const fareRes = await post('/fare/oneway', { sessionId, flightKey });
  console.log('\n--- RAW FARE RESPONSE ---');
  console.log(JSON.stringify(fareRes.body, null, 2).substring(0, 2000));

  // Find fareId
  function findKey(obj, key, depth = 0) {
    if (depth > 6 || !obj) return undefined;
    if (typeof obj === 'object') {
      if (obj[key] !== undefined) return obj[key];
      for (const v of Object.values(obj)) {
        const r = findKey(v, key, depth + 1);
        if (r !== undefined) return r;
      }
    }
    return undefined;
  }

  const fareId = findKey(fareRes.body.data, 'fareId');
  console.log(`\nfareId found: ${fareId}`);
  if (!fareId) { console.error('No fareId'); return; }

  // Review
  const reviewRes = await post('/review', { priceIds: [fareId] });
  console.log('\n--- RAW REVIEW RESPONSE (truncated) ---');
  console.log(JSON.stringify(reviewRes.body, null, 2).substring(0, 1500));
  
  const bookingId = findKey(reviewRes.body.data, 'bookingId');
  console.log(`\nbookingId found: ${bookingId}`);
  if (!bookingId) { console.error('No bookingId'); return; }

  // Seat - raw response dump
  const seatRes = await post('/seat', { bookingId });
  console.log('\n\n═══════════════════════════════════════');
  console.log('         FULL SEAT API RESPONSE');
  console.log('═══════════════════════════════════════');
  console.log(JSON.stringify(seatRes.body, null, 2));
}

main().catch(e => { console.error('Fatal:', e.message); });
