import { TRIPJACK_FIELD_MAP } from "../../constants/tripjackFields";

type AnyObject = { [key: string]: any };

class TripjackFieldMapper {

    static map(data: any): any {
        if (Array.isArray(data)) {
            return data.map((item) => this.map(item));
        }

        if (data !== null && typeof data === "object") {
            return Object.keys(data).reduce((acc: AnyObject, key: string) => {

                const mappedKey =
                    TRIPJACK_FIELD_MAP[key as keyof typeof TRIPJACK_FIELD_MAP] || key;

                acc[mappedKey] = this.map(data[key]);

                return acc;
            }, {});
        }

        return data;
    }
}

export default TripjackFieldMapper;