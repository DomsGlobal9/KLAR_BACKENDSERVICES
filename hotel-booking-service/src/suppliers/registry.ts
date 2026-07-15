import { BookingSupplier } from "./types";

class BookingSupplierRegistry {
  private suppliers: BookingSupplier[] = [];

  /** Called once per supplier at module-load time (see each suppliers/<name>/index.ts). */
  register(supplier: BookingSupplier): void {
    this.suppliers.push(supplier);
  }

  all(): BookingSupplier[] {
    return this.suppliers;
  }

  getByCode(code: string): BookingSupplier | undefined {
    return this.suppliers.find((s) => s.code === code);
  }
}

export const bookingSupplierRegistry = new BookingSupplierRegistry();
