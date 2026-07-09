export * from "./types";
export { supplierRegistry } from "./registry";

// Registration order matters: tripjack's ownsPropertyId() is a specific
// predicate; rategain's is a catch-all default (always true). tripjack MUST
// be imported (and therefore registered) first so resolveByPropertyId()'s
// first-match lookup checks the specific case before falling through to the
// default — this reproduces the original `isTripJack() ? TJ : RG` behavior.
import "./tripjack";
import "./rategain";
