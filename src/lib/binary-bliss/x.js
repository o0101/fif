import { BinaryHandler } from './binary-bliss.js';
const h = new BinaryHandler;
h.openFile('my.bin');
h.writeMagic("PRICES");
h.writeLength(4);
h.float(4.99);
h.float(5.99);
h.float(6.99);
h.float(9.99);
h.closeFile();

h.openFile('my.bin');
h.readMagic("PRICES");
const len = h.readLength();
const prices = [];
for( let i = 0; i < len; i++ ) {
  prices[i] = h.float().last.value;
}
h.closeFile();

console.log({rawPrices: prices, fitPrices: prices.map(p => p.toFixed(2))});
