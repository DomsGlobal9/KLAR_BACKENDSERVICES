import { CabSupplier } from "./types";

class CabSupplierRegistry {
  private suppliers: CabSupplier[] = [];

  /** Called once per supplier at module-load time (see each suppliers/<name>/index.ts). */
  register(supplier: CabSupplier): void {
    if (this.suppliers.some((s) => s.code === supplier.code)) return;
    this.suppliers.push(supplier);
  }

  all(): CabSupplier[] {
    return this.suppliers;
  }

  getByCode(code: string): CabSupplier | undefined {
    return this.suppliers.find((s) => s.code === code);
  }
}

export const cabSupplierRegistry = new CabSupplierRegistry();
