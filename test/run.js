import { testS101 } from './s101.js';
import { testBer } from './ber.js';
import { testEmber } from './ember.js';
import { testFloat64 } from './float64.js';
import { report } from './helpers.js';

testS101();
testEmber();
testFloat64();
testBer();
report();
