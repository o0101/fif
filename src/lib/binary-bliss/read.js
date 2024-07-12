import {BinaryHandler} from './binary-bliss.js'

const h = new BinaryHandler;
h.openFile('8086.bin');
const format = "readMagic('GR').uint32('page').pojo('metadata')";//.gets('bookText')";
h.readTranscript(format);
h.closeFile();
