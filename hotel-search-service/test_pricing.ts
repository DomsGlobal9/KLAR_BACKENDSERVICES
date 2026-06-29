import { convertToINR, detectSupplierCurrency } from './src/utils/pricing.util';

const rate1 = {
  RoomRate: "21.52",
  taxes: {
    taxes: [{ included: true, amount: "0.98", currency: "USD", clientAmount: "0.98", clientCurrency: "USD" }],
    allIncluded: true
  }
};

const currency = detectSupplierCurrency(rate1);
console.log('Currency:', currency);
const rawTotalPrice = Number(rate1.RoomRate);
const rawTaxAmount = Number(rate1.taxes.taxes[0].amount);
console.log('rawTotalPrice:', rawTotalPrice, 'rawTaxAmount:', rawTaxAmount);

console.log('Converted Total:', convertToINR(rawTotalPrice, currency));
console.log('Converted Tax:', convertToINR(rawTaxAmount, currency));
