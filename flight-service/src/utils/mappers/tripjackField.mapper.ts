import { TRIPJACK_FIELD_MAP } from "../../constants/tripjackFields";

type AnyObject = { [key: string]: any };

class TripjackFieldMapper {

    /**
     * Sanitizes Tripjack's custom text formatting tags into readable alternatives.
     */
    private static sanitizePolicyText(value: any): any {
        if (typeof value !== "string") return value;

        // Check if the string contains Tripjack's custom formatting flags
        if (value.includes("__nls__") || value.includes("__bs__") || value.includes("__be__")) {
            return value
                .replace(/__nls__/g, "\n")      // Converts to a standard newline character
                .replace(/__bs__/g, " ")        // Removes bold start marker
                .replace(/__be__/g, ": ");      // Cleans up bold end marker cleanly
        }

        return value;
    }

    static map(data: any): any {
        if (Array.isArray(data)) {
            return data.map((item) => this.map(item));
        }

        if (data !== null && typeof data === "object") {
            return Object.keys(data).reduce((acc: AnyObject, key: string) => {
                const mappedKey =
                    TRIPJACK_FIELD_MAP[key as keyof typeof TRIPJACK_FIELD_MAP] || key;

                // Map recursively
                let mappedValue = this.map(data[key]);

                // Sanitize text if it's a policy information string
                if (mappedKey === "policyInfo" || key === "policyInfo") {
                    mappedValue = this.sanitizePolicyText(mappedValue);
                }

                acc[mappedKey] = mappedValue;
                return acc;
            }, {});
        }

        return data;
    }
}

export default TripjackFieldMapper;