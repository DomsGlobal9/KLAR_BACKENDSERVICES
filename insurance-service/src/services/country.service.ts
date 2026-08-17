import fs from "fs";
import path from "path";

export interface Country {
    id: number | string;
    code: string;
    name: string;
    continent?: string;
    wikipedia_link?: string;
    keywords?: string;
}

export class CountryService {
    private countriesCache: Country[] | null = null;

    private getCsvPath(): string {
        const candidatePaths = [
            path.resolve(__dirname, "../static/countries.csv"),
            path.resolve(__dirname, "../../src/static/countries.csv"),
            path.resolve(process.cwd(), "src/static/countries.csv"),
            path.resolve(process.cwd(), "dist/static/countries.csv"),
            path.resolve(process.cwd(), "KLAR_BACKENDSERVICES/insurance-service/src/static/countries.csv"),
        ];

        for (const p of candidatePaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }
        throw new Error("countries.csv static file not found");
    }

    private parseCsvLine(line: string): string[] {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = "";
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result.map((s) => s.replace(/^"|"$/g, ""));
    }

    private loadCountries(): Country[] {
        if (this.countriesCache) {
            return this.countriesCache;
        }

        const csvPath = this.getCsvPath();
        const fileContent = fs.readFileSync(csvPath, "utf-8");
        const lines = fileContent.split(/\r?\n/).filter((line) => line.trim().length > 0);

        if (lines.length === 0) {
            this.countriesCache = [];
            return [];
        }

        const countries: Country[] = [];
        for (let i = 1; i < lines.length; i++) {
            const row = this.parseCsvLine(lines[i]);
            if (row.length >= 3) {
                const idRaw = row[0];
                const code = row[1] || "";
                const name = row[2] || "";
                const continent = row[3] || "";
                const wikipedia_link = row[4] || "";
                const keywords = row[5] || "";

                if (code || name) {
                    countries.push({
                        id: isNaN(Number(idRaw)) ? idRaw : Number(idRaw),
                        code,
                        name,
                        continent,
                        wikipedia_link,
                        keywords,
                    });
                }
            }
        }

        this.countriesCache = countries;
        return countries;
    }

    public search(query?: string): Country[] {
        const allCountries = this.loadCountries();
        if (query === undefined || query === null) {
            return allCountries;
        }

        const trimmed = query.trim();
        if (trimmed.length === 0) {
            return allCountries;
        }

        // Minimum 2 letters required for search
        if (trimmed.length < 2) {
            return [];
        }

        const q = trimmed.toLowerCase();

        const matches = allCountries.filter((country) => {
            const codeMatch = country.code.toLowerCase().includes(q);
            const nameMatch = country.name.toLowerCase().includes(q);
            const idMatch = String(country.id).toLowerCase() === q;
            const keywordsMatch = country.keywords ? country.keywords.toLowerCase().includes(q) : false;
            return codeMatch || nameMatch || idMatch || keywordsMatch;
        });

        // Priority scoring:
        // Priority 1: Exact country code match (e.g. code "IN" for query "IN")
        // Priority 2: Exact country name match (e.g. name "Chad" for query "Chad")
        // Priority 3: Country name starts with query (e.g. "India", "Indonesia" for query "IN")
        // Priority 4: Country code starts with query
        // Priority 5: Other partial matches (e.g. "China", "Finland" containing "in")
        const getPriority = (c: Country): number => {
            const codeLower = c.code.toLowerCase();
            const nameLower = c.name.toLowerCase();

            if (codeLower === q) return 1;
            if (nameLower === q) return 2;
            if (nameLower.startsWith(q)) return 3;
            if (codeLower.startsWith(q)) return 4;
            return 5;
        };

        return matches.sort((a, b) => {
            const prioA = getPriority(a);
            const prioB = getPriority(b);

            if (prioA !== prioB) {
                return prioA - prioB;
            }

            return a.name.localeCompare(b.name);
        });
    }
}

export const countryService = new CountryService();
