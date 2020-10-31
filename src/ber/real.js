import {
  integer_encoded_length,
  integer_encode,
  integer_decode,
  integer_encode_with_length,
} from './integer.js';

const u8 = new Uint8Array(8);
const data = new DataView(u8.buffer);
const UINT32_MAX = 0xffffffff;

export function split_float64(value) {
  data.setFloat64(0, value);

  const sign = u8[0] >> 7;
  let exponent = (((u8[0] & 0x7f) << 4) | (u8[1] >> 4)) - 1023;
  let mantissa;

  if (exponent === -1023) {
    // subnormal float
    exponent = -1022;

    const mantissa20 = data.getUint32(0) & 0xfffff;

    mantissa = mantissa20 * (UINT32_MAX + 1) + data.getUint32(4);
  } else {
    const tmp = 1023 + 52;

    u8[0] = tmp >> 4;
    u8[1] &= 0xf;
    u8[1] |= (tmp << 4) & 0xff;

    mantissa = data.getFloat64(0);
  }

  return [sign, exponent - 52, mantissa];
}

export function join_float64(sign, exponent, mantissa) {
  if (exponent >= -1023) {
    data.setFloat64(0, mantissa);

    exponent += 1023 + 52;

    if (sign) exponent |= 1 << 11;

    u8[0] = exponent >> 4;
    u8[1] &= 0xf;
    u8[1] |= (exponent << 4) & 0xf0;

    return data.getFloat64(0);
  } else {
    return (sign ? -1 : 1) * mantissa * Math.pow(2, exponent);
  }
}

export function real_encoded_length(value) {
  value = +value;

  if (value === 0.0) {
    return Object.is(value, 0) ? 0 : 1;
  } else if (value !== value || !isFinite(value)) {
    return 1;
  }

  const [, exponent, mantissa] = split_float64(value);

  return (
    1 + integer_encoded_length(exponent) + integer_encoded_length(mantissa)
  );
}

const BER_REAL_PLUS_INFINITY = 0x40;
const BER_REAL_MINUS_INFINITY = 0x41;
const BER_REAL_NAN = 0x42;
const BER_REAL_MINUS_ZERO = 0x43;

export function real_encode(data, pos, value) {
  value = +value;

  if (value === 0.0) {
    if (Object.is(value, 0))
      return pos;

    data.setUint8(pos, BER_REAL_MINUS_ZERO);
    pos++;
    return pos;
  } else if (value !== value) {
    data.setUint8(pos, BER_REAL_NAN);
    pos++;
    return pos;
  } else if (!isFinite(value)) {
    data.setUint8(
      pos,
      value > 0 ? BER_REAL_PLUS_INFINITY : BER_REAL_MINUS_INFINITY
    );
    pos++;
    return pos;
  } else {
    const [sign, exponent, mantissa] = split_float64(value);

    const exponent_length = integer_encoded_length(exponent);

    data.setUint8(pos, (sign ? 0xc0 : 0x80) | exponent_length);
    pos += 1;
    pos = integer_encode_with_length(data, pos, exponent, exponent_length);
    pos = integer_encode(data, pos, mantissa);

    //console.log('>', [ sign, exponent, mantissa], exponent_length, integer_encoded_length(mantissa));

    return pos;
  }
}

export function real_decode(data, pos, length) {
  let value;

  if (length === 0) {
    value = 0.0;
  } else if (length === 1) {
    const tmp = data.getUint8(pos);
    pos++;

    switch (tmp) {
      case BER_REAL_PLUS_INFINITY:
        value = Infinity;
        break;
      case BER_REAL_MINUS_INFINITY:
        value = -Infinity;
        break;
      case BER_REAL_NAN:
        value = NaN;
        break;
      case BER_REAL_MINUS_ZERO:
        value = -0.0;
        break;
      default:
        throw new Error('Malformed REAL.');
    }
  } else {
    const start = pos;
    const tmp = data.getUint8(pos);
    pos++;

    if (!(tmp & (1 << 7)))
      throw new Error('TYPE_REAL only supports binary encoding.');

    const sign = tmp & (1 << 6);
    const F = (tmp >> 2) & 3;
    let exponent_length = tmp & 3;

    if (exponent_length === 3) {
      exponent_length = data.getUint8(pos);
      pos++;
    }

    const exponent = integer_decode(data, pos, exponent_length);
    pos += exponent_length;

    const mantissa_length = start + length - pos;

    const mantissa = integer_decode(data, pos, mantissa_length);

    //console.log('<', [ sign, exponent, mantissa ], exponent_length, mantissa_length);

    value = join_float64(sign, exponent, mantissa);
  }

  return value;
}
