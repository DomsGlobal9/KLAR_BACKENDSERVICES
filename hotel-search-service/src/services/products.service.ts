import { supplierRegistry } from "../suppliers";

class ProductsService {
  async getProducts(payload: any) {
    const propertyId = (
      payload.propertyId ||
      payload.PropertyId ||
      ""
    ).toString();

    // Adding a new supplier = register() it in suppliers/index.ts; this
    // routing never needs to change.
    const supplier = supplierRegistry.resolveByPropertyId(propertyId);
    if (!supplier) {
      throw new Error(`No supplier registered to handle propertyId: ${propertyId}`);
    }
    return supplier.getProducts(payload);
  }
}

export const productsService = new ProductsService();
