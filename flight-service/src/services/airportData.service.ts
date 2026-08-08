import fs from "fs";
import path from "path";
import RedisConfig from "../config/redis.config";

export interface AirportRecord {
    iata: string;
    name: string;
    city: string;
    country: string;
    countryCode?: string;
    lat?: number;
    lon?: number;
    type?: string;
    keywords?: string;
}

class AirportDataService {
    private static instance: AirportDataService;
    private airportsCache: AirportRecord[] | null = null;
    private readonly REDIS_CACHE_KEY = "airports:all_data";
    private readonly CACHE_TTL_SECONDS = 86400; // 24 hours

    public static getInstance(): AirportDataService {
        if (!AirportDataService.instance) {
            AirportDataService.instance = new AirportDataService();
        }
        return AirportDataService.instance;
    }

    /**
     * Parses standard CSV text with support for double-quoted fields & internal commas/quotes.
     */
    private parseCSV(text: string): string[][] {
        const lines: string[][] = [];
        let row: string[] = [];
        let field = "";
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (inQuotes) {
                if (c === '"') {
                    if (i + 1 < text.length && text[i + 1] === '"') {
                        field += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    field += c;
                }
            } else {
                if (c === '"') {
                    inQuotes = true;
                } else if (c === ",") {
                    row.push(field);
                    field = "";
                } else if (c === "\r") {
                    // ignore carriage return
                } else if (c === "\n") {
                    row.push(field);
                    lines.push(row);
                    row = [];
                    field = "";
                } else {
                    field += c;
                }
            }
        }
        if (field.length > 0 || row.length > 0) {
            row.push(field);
            lines.push(row);
        }
        return lines;
    }

    /**
     * Locates static CSV files across dev (src/static) and build (dist/static or src/static).
     */
    private getStaticFilePath(filename: string): string | null {
        const candidatePaths = [
            path.join(process.cwd(), "src", "static", filename),
            path.join(process.cwd(), "dist", "static", filename),
            path.join(__dirname, "..", "static", filename),
            path.join(__dirname, "..", "..", "src", "static", filename),
        ];

        for (const p of candidatePaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }
        return null;
    }

    /**
     * Parses countries.csv into ISO Code -> Country Name mapping.
     */
    private loadCountriesMap(): Map<string, string> {
        const countriesMap = new Map<string, string>();
        const countryFilePath = this.getStaticFilePath("countries.csv");

        if (!countryFilePath) {
            console.warn("[AirportDataService] countries.csv not found");
            return countriesMap;
        }

        try {
            const content = fs.readFileSync(countryFilePath, "utf-8");
            const rows = this.parseCSV(content);

            if (rows.length > 0) {
                const header = rows[0].map(h => h.trim().toLowerCase());
                const codeIdx = header.indexOf("code");
                const nameIdx = header.indexOf("name");

                if (codeIdx !== -1 && nameIdx !== -1) {
                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i];
                        if (row.length > Math.max(codeIdx, nameIdx)) {
                            const code = row[codeIdx]?.trim().toUpperCase();
                            const name = row[nameIdx]?.trim();
                            if (code && name) {
                                countriesMap.set(code, name);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("[AirportDataService] Error parsing countries.csv:", error);
        }

        return countriesMap;
    }

    /**
     * Loads airport records from airports (1).csv and OpenFlights.csv, merges & deduplicates them.
     */
    private buildAirportsFromCSV(): AirportRecord[] {
        const countriesMap = this.loadCountriesMap();
        const airportMap = new Map<string, AirportRecord>();

        // 1. Process airports (1).csv
        const airportsFilePath = this.getStaticFilePath("airports (1).csv");
        if (airportsFilePath) {
            try {
                console.log(`[AirportDataService] Reading ${airportsFilePath}...`);
                const content = fs.readFileSync(airportsFilePath, "utf-8");
                const rows = this.parseCSV(content);

                if (rows.length > 0) {
                    const header = rows[0].map(h => h.trim().toLowerCase());
                    const iataIdx = header.indexOf("iata_code");
                    const nameIdx = header.indexOf("name");
                    const cityIdx = header.indexOf("municipality");
                    const countryIdx = header.indexOf("iso_country");
                    const regionIdx = header.indexOf("iso_region");
                    const keywordsIdx = header.indexOf("keywords");
                    const latIdx = header.indexOf("latitude_deg");
                    const lonIdx = header.indexOf("longitude_deg");
                    const typeIdx = header.indexOf("type");

                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i];
                        if (row.length === 0) continue;

                        const iata = (iataIdx !== -1 ? row[iataIdx] : "")?.trim().toUpperCase();
                        const name = (nameIdx !== -1 ? row[nameIdx] : "")?.trim();
                        const city = (cityIdx !== -1 ? row[cityIdx] : "")?.trim();
                        const isoCountry = (countryIdx !== -1 ? row[countryIdx] : "")?.trim().toUpperCase();
                        const isoRegion = (regionIdx !== -1 ? row[regionIdx] : "")?.trim().toUpperCase();
                        let keywords = (keywordsIdx !== -1 ? row[keywordsIdx] : "")?.trim();
                        const country = countriesMap.get(isoCountry) || isoCountry || "";
                        const type = (typeIdx !== -1 ? row[typeIdx] : "")?.trim();

                        if (isoRegion === "IN-GA" && !keywords.toLowerCase().includes("goa")) {
                            keywords = (keywords ? keywords + " " : "") + "Goa";
                        }

                        const latStr = latIdx !== -1 ? row[latIdx] : "";
                        const lonStr = lonIdx !== -1 ? row[lonIdx] : "";
                        const lat = latStr ? parseFloat(latStr) : undefined;
                        const lon = lonStr ? parseFloat(lonStr) : undefined;

                        // Include record if it has a valid name/city
                        if (name || city) {
                            const record: AirportRecord = {
                                iata: (iata && iata !== "\\N" && iata.length === 3) ? iata : "",
                                name: name || city || iata,
                                city: city || name || "",
                                country: country,
                                countryCode: isoCountry,
                                lat: isNaN(lat!) ? undefined : lat,
                                lon: isNaN(lon!) ? undefined : lon,
                                type: type,
                                keywords: keywords || undefined
                            };

                            const key = record.iata ? `IATA_${record.iata}` : `NAME_${record.name.toLowerCase()}_${record.city.toLowerCase()}`;
                            
                            // Prefer entries with 3-letter IATA code or large/medium airports
                            if (!airportMap.has(key)) {
                                airportMap.set(key, record);
                            } else {
                                const existing = airportMap.get(key)!;
                                if (!existing.iata && record.iata) {
                                    airportMap.set(key, record);
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("[AirportDataService] Error parsing airports (1).csv:", err);
            }
        } else {
            console.warn("[AirportDataService] airports (1).csv not found");
        }

        // 2. Process OpenFlights.csv
        const openFlightsFilePath = this.getStaticFilePath("OpenFlights.csv");
        if (openFlightsFilePath) {
            try {
                console.log(`[AirportDataService] Reading ${openFlightsFilePath}...`);
                const content = fs.readFileSync(openFlightsFilePath, "utf-8");
                const rows = this.parseCSV(content);

                for (const row of rows) {
                    if (row.length < 5) continue;

                    const name = row[1]?.trim();
                    const city = row[2]?.trim();
                    const country = row[3]?.trim();
                    const iataRaw = row[4]?.trim().toUpperCase();
                    const iata = (iataRaw && iataRaw !== "\\N" && iataRaw.length === 3) ? iataRaw : "";

                    const latStr = row[6]?.trim();
                    const lonStr = row[7]?.trim();
                    const lat = latStr ? parseFloat(latStr) : undefined;
                    const lon = lonStr ? parseFloat(lonStr) : undefined;

                    if (name || city) {
                        const record: AirportRecord = {
                            iata,
                            name: name || city || iata,
                            city: city || name || "",
                            country: country || "",
                            lat: isNaN(lat!) ? undefined : lat,
                            lon: isNaN(lon!) ? undefined : lon
                        };

                        const key = record.iata ? `IATA_${record.iata}` : `NAME_${record.name.toLowerCase()}_${record.city.toLowerCase()}`;
                        if (!airportMap.has(key)) {
                            airportMap.set(key, record);
                        } else {
                            // Supplement missing fields in existing record if needed
                            const existing = airportMap.get(key)!;
                            if (!existing.country && record.country) existing.country = record.country;
                            if (!existing.city && record.city) existing.city = record.city;
                        }
                    }
                }
            } catch (err) {
                console.error("[AirportDataService] Error parsing OpenFlights.csv:", err);
            }
        } else {
            console.warn("[AirportDataService] OpenFlights.csv not found");
        }

        const result = Array.from(airportMap.values());
        console.log(`[AirportDataService] Built index with ${result.length} total airport records`);
        return result;
    }

    /**
     * Primary initialization method called on backend startup.
     */
    public async initialize(): Promise<void> {
        console.log("[AirportDataService] Initializing airport dataset...");
        let redisAvailable = false;

        try {
            redisAvailable = await RedisConfig.healthCheck();
            console.log(`[AirportDataService] Redis healthCheck status: ${redisAvailable ? "CONNECTED" : "OFFLINE"}`);
        } catch (e) {
            console.warn("[AirportDataService] Redis healthCheck error, fallback to CSV parsing.");
        }

        // Try reading from Redis if available
        if (redisAvailable) {
            try {
                const redisClient = RedisConfig.getInstance();
                const cachedData = await redisClient.get(this.REDIS_CACHE_KEY);

                if (cachedData) {
                    this.airportsCache = JSON.parse(cachedData);
                    console.log(`[AirportDataService] ✅ Loaded ${this.airportsCache?.length} airports from Redis cache (key: ${this.REDIS_CACHE_KEY})`);
                    return;
                } else {
                    console.log(`[AirportDataService] Cache MISS for key: ${this.REDIS_CACHE_KEY}`);
                }
            } catch (err) {
                console.error("[AirportDataService] Error fetching from Redis:", err);
            }
        }

        // Parse CSV files when Redis is missing or cache missed
        const airports = this.buildAirportsFromCSV();
        this.airportsCache = airports;

        // Save to Redis for future use if Redis is available
        if (redisAvailable && airports.length > 0) {
            try {
                const redisClient = RedisConfig.getInstance();
                await redisClient.set(
                    this.REDIS_CACHE_KEY,
                    JSON.stringify(airports),
                    "EX",
                    this.CACHE_TTL_SECONDS
                );
                console.log(`[AirportDataService] ✅ Saved ${airports.length} airports to Redis cache (TTL: ${this.CACHE_TTL_SECONDS}s)`);
            } catch (err) {
                console.error("[AirportDataService] Failed to save airports to Redis:", err);
            }
        }

        console.log("[AirportDataService] ✅ Initialization complete and ready to serve requests.");
    }

    /**
     * Returns the loaded airports array.
     */
    public getAirports(): AirportRecord[] {
        if (!this.airportsCache) {
            console.warn("[AirportDataService] airportsCache is null. Fallback synchronous CSV build.");
            this.airportsCache = this.buildAirportsFromCSV();
        }
        return this.airportsCache;
    }
}

export default AirportDataService.getInstance();
