import {
    TRIPJACK_FIELD_MAP,
    BOOKING_LEVEL_FIELD_MAP
} from "../../constants/tripjackFields";

type AnyObject = Record<string, any>;

export class TripjackFieldMapper {

    static map(data: any): any {
        return this.transform(data);
    }

    private static transform(data: any): any {

        if (Array.isArray(data)) {
            return data.map(item => this.transform(item));
        }

        if (data !== null && typeof data === "object") {

            return Object.keys(data).reduce((acc: AnyObject, key: string) => {

                const mappedKey =
                    BOOKING_LEVEL_FIELD_MAP[key as keyof typeof BOOKING_LEVEL_FIELD_MAP] ||
                    TRIPJACK_FIELD_MAP[key as keyof typeof TRIPJACK_FIELD_MAP] ||
                    key;

                acc[mappedKey] = this.transform(data[key]);

                return acc;
            }, {});
        }

        return data;
    }
}