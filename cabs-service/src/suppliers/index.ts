/**
 * Importing this module registers every cab supplier with the registry.
 * Import it once at bootstrap (server.ts) so the registry is populated.
 */
import "./tripjack";

export { cabSupplierRegistry } from "./registry";
