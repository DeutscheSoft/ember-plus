import { assert_equal } from './helpers.js';
import {
  split_float64,
  join_float64,
  real_encode,
  real_decode,
} from '../src/ber/real.js';

function test_float_split_join(a) {
  const [sign, exponent, mantissa] = split_float64(a);

  //console.log('splitting %o -> %o', a, [ sign, exponent, mantissa ]);

  assert_equal((sign ? -1 : 1) * mantissa * Math.pow(2, exponent), a);

  const b = join_float64(sign, exponent, mantissa);

  assert_equal(a, b);
}

function test_float_encode_decode(f) {
  const buf = new ArrayBuffer(32);
  const data = new DataView(buf);

  const length = real_encode(data, 0, f);

  const value = real_decode(data, 0, length);

  if (!Object.is(f, value))
    throw new Error(`Failed to encode and decode ${f} (result: ${value}).`);
}

function test_float_with_encoding(value, enc) {
  const u8 = new Uint8Array(enc.length);
  u8.set(enc, 0);

  const dec = real_decode(new DataView(u8.buffer), 0, u8.length);

  assert_equal(dec, value);

  const len = real_encode(new DataView(u8.buffer), 0, value);

  assert_equal(len, enc.length);

  enc.forEach((value, i) => {
    assert_equal(value, u8[i]);
  });
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
    0.0,
    -0.0,
    Infinity,
    -Infinity,
  ];

  for (let i = -100; i <= 100; i++) result.push(Math.pow(13, i));

  for (let i = 0; i < 1000; i++) result.push(Math.random());

  return result;
}

export function testFloat64() {
  someFloats().forEach(test_float_split_join);
  someFloats().forEach(test_float_encode_decode);

  test_float_with_encoding(1398101.25, [0x80, 0xfe, 0x55, 0x55, 0x55]);
}
