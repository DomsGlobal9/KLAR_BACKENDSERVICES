export * from "./flightFilter";
export * from "./filterValidator";
export * from "../../interface/flight/filter.interface";

import { filterFlights } from "./flightFilter";
import { FilterValidator } from "./filterValidator";
export { filterFlights, FilterValidator };

export default {
    filterFlights,
    FilterValidator
};