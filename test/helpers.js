import { format } from 'util';

export function to_u8(buf) {
  if (ArrayBuffer.isView(buf)) {
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } else {
    return new Uint8Array(buf);
  }
}

export function is_equal(b1, b2) {
  switch (typeof b1) {
    case 'number':
      if (b1 !== b1) return b2 !== b2;
      if (b1 === 0) return Object.is(b1, b2);
    /* FallThrought */
    case 'bigint':
    /* FallThrought */
    case 'string':
      return b1 === b2;
    case 'object':
      if (Array.isArray(b1)) {
        return JSON.stringify(b1) === JSON.stringify(b2);
      }
      break;
  }
  return JSON.stringify(to_u8(b1)) === JSON.stringify(to_u8(b2));
}

let ok = 0;

export function assert_equal(b1, b2) {
  if (!is_equal(b1, b2)) {
    throw new Error(format('assert_equal(%o, %o) failed.', b1, b2));
  } else {
    ok++;
  }
}

export function assert(condition, msg) {
  if (!condition) {
    throw new Error(msg || 'assert failed.');
  } else {
    ok++;
  }
}

export function report() {
  console.log('%d OK', ok);
}
