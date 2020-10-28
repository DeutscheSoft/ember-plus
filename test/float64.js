import { assert_equal } from './helpers.js';
import { split_float64, join_float64 } from '../src/ber/real.js';

function test_float_split_join(a) {
  const [sign, exponent, mantissa] = split_float64(a);

  //console.log('splitting %o -> %o', a, [ sign, exponent, mantissa ]);

  assert_equal((sign ? -1 : 1) * mantissa * Math.pow(2, exponent), a);

  const b = join_float64(sign, exponent, mantissa);

  assert_equal(a, b);
}

function float_from_bytes(...bytes) {
  const u8 = new Uint8Array(8);
  for (let i = 0; i < bytes.length; i++) u8[i] = bytes[i];
  return new DataView(u8.buffer).getFloat64(0);
}

const min_subnormal = float_from_bytes(0, 0, 0, 0, 0, 0, 0, 1);
const max_normal = float_from_bytes(
  0x7f,
  0xef,
  0xff,
  0xff,
  0xff,
  0xff,
  0xff,
  0xff
);
const max_subnormal = float_from_bytes(
  0x00,
  0x0f,
  0xff,
  0xff,
  0xff,
  0xff,
  0xff,
  0xff
);
const min_normal = float_from_bytes(
  0x00,
  0x10,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00
);

export function someFloats() {
  const result = [
    1.0,
    Math.E,
    Math.PI,
    min_subnormal,
    max_subnormal,
    min_normal,
    max_normal,
  ];

  for (let i = -100; i <= 100; i++) result.push(Math.pow(13, i));

  for (let i = 0; i < 1000; i++) result.push(Math.random());

  return result;
}

export function testFloat64() {
  someFloats().forEach(test_float_split_join);
}
