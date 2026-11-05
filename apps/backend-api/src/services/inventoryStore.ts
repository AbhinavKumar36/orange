export interface MockStockRecord {
  physical: number;
  reserved: number;
}

export const mockStockStore = new Map<string, MockStockRecord>();
