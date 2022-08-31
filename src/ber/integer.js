const INT53_MIN = Number.MIN_SAFE_INTEGER;
const INT53_MAX = Number.MAX_SAFE_INTEGER;
const INT48_MIN = -0x800000000000;
const INT48_MAX = 0x7fffffffffff;
const INT40_MIN = -0x8000000000;
const INT40_MAX = 0x7fffffffff;
const INT32_MIN = -0x80000000;
const INT32_MAX = 0x7fffffff;
const INT24_MIN = -0x800000;
const INT24_MAX = 0x7fffff;
const INT16_MIN = -0x8000;
const INT16_MAX = 0x7fff;
const INT8_MIN = -0x80;
const INT8_MAX = 0x7f;

const UINT48_MAX = 0xffffffffffff;
const UINT40_MAX = 0xffffffffff;
const UINT32_MAX = 0xffffffff;
const UINT24_MAX = 0xffffff;
const UINT16_MAX = 0xffff;
const UINT8_MAX = 0xff;

import {
  HAS_BIGINT,
  INT64_MIN,
  INT64_MAX,
  INT56_MIN,
  INT56_MAX,
  UINT64_MAX,
  UINT56_MAX,
} from './bigint.js';

export function integer_encoded_length(value) {
  if (typeof value === 'bigint') {
    if (value >= INT53_MIN && value <= INT53_MAX) {
      // This BigInt fits into a regular number.
      value = Number(value);
    } else {
      if (value >= INT64_MIN && value <= INT64_MAX) {
        if (value >= INT56_MIN && value <= INT56_MAX) {
          return 7;
        } else {
          return 8;
        }
      } else {
        throw new TypeError('No support for integers larger than 64 bit.');
      }
    }
  }

  value = +value;

  if (!isFinite(value) || value !== value) throw new Error('Expected integer.');

  if (value >= INT32_MIN && value <= INT32_MAX) {
    if (value >= INT16_MIN && value <= INT16_MAX) {
      if (value >= INT8_MIN && value <= INT8_MAX) {
        return 1;
      } else {
        return 2;
      }
    } else {
      if (value >= INT24_MIN && value <= INT24_MAX) {
        return 3;
      } else {
        return 4;
      }
    }
  } else {
    if (value >= INT48_MIN && value <= INT48_MAX) {
      if (value >= INT40_MIN && value <= INT40_MAX) return 5;
      else return 6;
    } else {
      if (value >= INT53_MIN && value <= INT53_MAX) {
        return 7;
      } else {
        throw new Error('No support for integers with more than 53 bits.');
      }
    }
  }
}

const u8 = new Uint8Array(8);
const u8_view = new DataView(u8.buffer);

export function integer_encode_with_length(data, pos, n, length) {
  if (typeof n === 'bigint') {
    if (length < 7) {
      n = Number(n);
    } else {
      if (length === 8) {
        data.setBigInt64(pos, n);
      } else {
        // length === 7
        u8_view.setBigInt64(0, n);
        for (let i = 0; i < 7; i++) {
          data.setUint8(pos + i, u8[1 + i]);
        }
      }
      return pos + length;
    }
  }

  n = +n;

  switch (length) {
    case 1:
      data.setInt8(pos, n);
      break;
    case 2:
      data.setInt16(pos, n);
      break;
    case 3:
      u8_view.setInt32(0, n);

      data.setUint8(pos + 0, u8[1]);
      data.setUint8(pos + 1, u8[2]);
      data.setUint8(pos + 2, u8[3]);
      break;
    case 4:
      data.setInt32(pos, n);
      break;
    case 5:
      {
        let u8 = n % (UINT8_MAX + 1);

        if (u8 < 0) u8 += UINT8_MAX + 1;

        const i32 = (n - u8) / (UINT8_MAX + 1);

        data.setInt32(pos, i32);
        data.setUint8(pos + 4, u8);
      }
      break;
    case 6:
      {
        let u16 = n % (UINT24_MAX + 1);

        if (u16 < 0) u16 += UINT16_MAX + 1;

        const i32 = (n - u16) / (UINT16_MAX + 1);

        data.setInt32(pos, i32);
        data.setUint16(pos + 4, u16);
      }
      break;
    case 7:
      {
        let u24 = n % (UINT24_MAX + 1);

        if (u24 < 0) u24 += UINT24_MAX + 1;

        const i32 = (n - u24) / (UINT24_MAX + 1);

        // Here we write the u24 first and overwrite its first byte
        // after with the i32.
        data.setUint32(pos + 3, u24);
        data.setInt32(pos, i32);
      }
      break;
    default:
    // Unreachable
  }

  return pos + length;
}

export function integer_encode(data, pos, n) {
  const length = integer_encoded_length(n);

  return integer_encode_with_length(data, pos, n, length);
}

export function integer_decode(data, pos, length) {
  switch (length) {
    case 1:
      return data.getInt8(pos);
    case 2:
      return data.getInt16(pos);
    case 3: {
      u8[1] = data.getUint8(pos + 0);
      u8[2] = data.getUint8(pos + 1);
      u8[3] = data.getUint8(pos + 2);

      u8[0] = u8[1] & 0x80 ? 255 : 0;

      return u8_view.getInt32(0);
    }
    case 4:
      return data.getInt32(pos);
    case 7:
    // FallThrough
    case 8: {
      if (HAS_BIGINT) {
        let value;

        if (length === 8) {
          value = data.getBigInt64(pos);
        } else {
          for (let i = 0; i < 7; i++) {
            u8[1 + i] = data.getUint8(pos + i);
          }
          u8[0] = u8[1] & 0x80 ? 255 : 0;
          value = u8_view.getBigInt64(0);
        }

        return value >= INT53_MIN && value <= INT53_MAX ? Number(value) : value;
      }
    }
    // FallThrough
    default: {
      let result = data.getInt32(pos);

      for (let i = 4; i < length; i++) {
        result = result * (UINT8_MAX + 1) + data.getUint8(pos + i);
      }

      return result;
    }
  }
}

export function unsigned_encoded_length(value) {
  if (typeof value === 'bigint') {
    if (value <= INT53_MAX) {
      // This BigInt fits into a regular number.
      value = Number(value);
    } else {
      if (value <= UINT64_MAX) {
        if (value <= UINT56_MAX) {
          return 7;
        } else {
          return 8;
        }
      } else {
        throw new TypeError('No support for integers larger than 64 bit.');
      }
    }
  }

  value = +value;

  if (!isFinite(value) || value !== value) throw new Error('Expected integer.');
  if (!(value >= 0)) throw new Error('Expected non-negative integer.');

  if (value <= UINT32_MAX) {
    if (value <= UINT16_MAX) {
      if (value <= UINT8_MAX) {
        return 1;
      } else {
        return 2;
      }
    } else {
      if (value <= UINT24_MAX) {
        return 3;
      } else {
        return 4;
      }
    }
  } else {
    if (value <= UINT48_MAX) {
      if (value <= UINT40_MAX) return 5;
      else return 6;
    } else {
      if (value <= INT53_MAX) {
        return 7;
      } else {
        throw new Error('No support for integers with more than 53 bits.');
      }
    }
  }
}

export function unsigned_decode(data, pos, length) {
  switch (length) {
    case 1:
      return data.getUint8(pos);
    case 2:
      return data.getUint16(pos);
    case 3: {
      u8[0] = 0;
      u8[1] = data.getUint8(pos + 0);
      u8[2] = data.getUint8(pos + 1);
      u8[3] = data.getUint8(pos + 2);

      return u8_view.getUint32(0);
    }
    case 4:
      return data.getUint32(pos);
    case 7:
    // FallThrough
    case 8: {
      if (HAS_BIGINT) {
        let value;

        if (length === 8) {
          value = data.getBigUint64(pos);
        } else {
          u8[0] = 0;
          for (let i = 0; i < 7; i++) {
            u8[1 + i] = data.getUint8(pos + i);
          }
          value = u8_view.getBigUint64(0);
        }

        return value <= INT53_MAX ? Number(value) : value;
      }
    }
    // FallThrough
    default: {
      let result = data.getUint32(pos);

      for (let i = 4; i < length; i++) {
        result = result * (UINT8_MAX + 1) + data.getUint8(pos + i);
      }

      return result;
    }
  }
}

export function unsigned_encode_with_length(data, pos, n, length) {
  if (typeof n === 'bigint') {
    if (length < 7) {
      n = Number(n);
    } else {
      if (length === 8) {
        data.setBigInt64(pos, n);
      } else {
        // length === 7
        u8_view.setBigInt64(0, n);
        for (let i = 0; i < 7; i++) {
          data.setUint8(pos + i, u8[1 + i]);
        }
      }
      return pos + length;
    }
  }

  if (!(n >= 0)) throw new Error('Expected unsigned number.');

  n = +n;

  switch (length) {
    case 1:
      data.setUint8(pos, n);
      break;
    case 2:
      data.setUint16(pos, n);
      break;
    case 3:
      u8_view.setUint32(0, n);

      data.setUint8(pos + 0, u8[1]);
      data.setUint8(pos + 1, u8[2]);
      data.setUint8(pos + 2, u8[3]);
      break;
    case 4:
      data.setUint32(pos, n);
      break;
    case 5:
      {
        let u8 = n % (UINT8_MAX + 1);

        if (u8 < 0) u8 += UINT8_MAX + 1;

        const i32 = (n - u8) / (UINT8_MAX + 1);

        data.setUint32(pos, i32);
        data.setUint8(pos + 4, u8);
      }
      break;
    case 6:
      {
        let u16 = n % (UINT16_MAX + 1);

        if (u16 < 0) u16 += UINT16_MAX + 1;

        const i32 = (n - u16) / (UINT16_MAX + 1);

        data.setUint32(pos, i32);
        data.setUint16(pos + 4, u16);
      }
      break;
    case 7:
      {
        let u24 = n % (UINT24_MAX + 1);

        if (u24 < 0) u24 += UINT24_MAX + 1;

        const i32 = (n - u24) / (UINT24_MAX + 1);

        // Here we write the u24 first and overwrite its first byte
        // after with the i32.
        data.setUint32(pos + 3, u24);
        data.setUint32(pos, i32);
      }
      break;
    default:
    // Unreachable
  }

  return pos + length;
}

export function unsigned_encode(data, pos, n) {
  const length = unsigned_encoded_length(n);

  return unsigned_encode_with_length(data, pos, n, length);
}
