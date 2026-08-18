type LogFields = Record<string, unknown>;

const REDACTED_KEYS = [
    "pax", "paxdetails", "travellers", "traveller", "passenger", "passengers",
    "firstname", "lastname", "middlename", "dob", "email", "phone", "mobile",
    "contactno", "passport", "passportno", "pnum", "pid", "pssprt",
    "card", "cardno", "cvv", "apikey", "api_key", "authorization", "token",
    "password", "secret", "gstnumber"
];

function isRedacted(key: string): boolean {
    return REDACTED_KEYS.includes(key.toLowerCase());
}

function scrub(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined) return value;
    if (depth > 4) return "[depth]";
    if (Array.isArray(value)) return value.slice(0, 20).map((item) => scrub(item, depth + 1));
    if (typeof value === "object") {
        return Object.entries(value as LogFields).reduce((acc: LogFields, [key, val]) => {
            acc[key] = isRedacted(key) ? "[redacted]" : scrub(val, depth + 1);
            return acc;
        }, {});
    }
    return value;
}

export function logFlightEvent(event: string, fields: LogFields = {}): void {
    const payload = scrub(fields) as LogFields;
    const line = JSON.stringify({ event, ts: new Date().toISOString(), ...payload });
    if (event.endsWith("_ERROR") || event.endsWith("_REJECTED")) {
        console.error(line);
        return;
    }
    console.log(line);
}

export async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const size = Math.max(1, Math.min(limit, items.length));
    const results = new Array<R>(items.length);
    let cursor = 0;

    const runners = Array.from({ length: size }, async () => {
        while (true) {
            const index = cursor++;
            if (index >= items.length) return;
            results[index] = await worker(items[index], index);
        }
    });

    await Promise.all(runners);
    return results;
}
