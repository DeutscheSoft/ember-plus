import {
  integer_encoded_length,
  integer_decode,
  integer_encode_with_length,
  unsigned_decode,
  unsigned_encode,
  unsigned_encoded_length,
} from './integer.js';

const u8 = new Uint8Array(8);
const data = new DataView(u8.buffer);
const UINT32_MAX = 0xffffffff;

function ctz32(value) {
  value |= 0;

  if (!value) return 32;

  value &= -value;
  return 31 - Math.clz32(value);
}

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
    u8[1] |= tmp << 4;

    mantissa = data.getFloat64(0);
  }

  let tz;

  if (mantissa && (tz = ctz32(mantissa))) {
    exponent += tz;
    mantissa /= Math.pow(2, tz);
  }

  if (mantissa && (tz = ctz32(mantissa))) {
    exponent += tz;
    mantissa /= Math.pow(2, tz);
  }

  return [sign, exponent - 52, mantissa];
}

export function join_float64(sign, exponent, mantissa) {
  if (sign) mantissa = -mantissa;
  if (exponent >= -1023) {
    data.setFloat64(0, mantissa);

    let ieee_exponent = ((u8[0] & 0x7f) << 4) | (u8[1] >> 4);

    ieee_exponent += exponent;

    u8[0] &= 0x80;
    u8[0] |= ieee_exponent >> 4;
    u8[1] &= 0x0f;
    u8[1] |= ieee_exponent << 4;

    return data.getFloat64(0);
  } else {
    return mantissa * Math.pow(2, exponent);
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
    1 + integer_encoded_length(exponent) + unsigned_encoded_length(mantissa)
  );
}

const BER_REAL_PLUS_INFINITY = 0x40;
const BER_REAL_MINUS_INFINITY = 0x41;
const BER_REAL_NAN = 0x42;
const BER_REAL_MINUS_ZERO = 0x43;

const BER_REAL_ENCODING_MASK = 0x80;
const BER_REAL_SIGN_MASK = 0x40;
const BER_REAL_BASE_MASK = 0x30;
const BER_REAL_EXPONENT_LENGTH_MASK = 3;

export function real_encode(data, pos, value) {
  value = +value;

  if (value === 0.0) {
    if (Object.is(value, 0)) return pos;

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

    // console.log({ sign, exponent, mantissa });

    const exponent_length = integer_encoded_length(exponent);

    const tmp = BER_REAL_ENCODING_MASK | (sign ? BER_REAL_SIGN_MASK : 0);

    data.setUint8(pos, tmp | (exponent_length - 1));
    pos += 1;
    pos = integer_encode_with_length(data, pos, exponent, exponent_length);
    pos = unsigned_encode(data, pos, mantissa);

    //console.log('>', { exponent_length, mantissa_length: integer_encoded_length(mantissa) })

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

    if (!(tmp & BER_REAL_ENCODING_MASK))
      throw new Error('TYPE_REAL only supports binary encoding.');

    if (tmp & BER_REAL_BASE_MASK)
      throw new Error('TYPE_REAL only supports base-2 encoding.');

    const sign = tmp & BER_REAL_SIGN_MASK;
    let exponent_length = (tmp & BER_REAL_EXPONENT_LENGTH_MASK) + 1;

    if (exponent_length === 4) {
      exponent_length = data.getUint8(pos);
      pos++;
    }

    const F = (tmp >> 2) & 0x03;
    const exponent = integer_decode(data, pos, exponent_length) + F;
    pos += exponent_length;

    const mantissa_length = start + length - pos;

    const mantissa = unsigned_decode(data, pos, mantissa_length);

    //console.log({ sign, exponent, mantissa });

    return join_float64(sign, exponent, mantissa);
  }

  return value;
}
