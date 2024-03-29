/* global BigInt */

import { TLV } from '../src/ber/tlv.js';
import { TYPE_RELATIVE_OID } from '../src/ber/constants.js';
import { someFloats } from './float64.js';
import { assert_equal, assert } from './helpers.js';
import { HAS_BIGINT } from '../src/ber/bigint.js';
import { join_float64 } from '../src/ber/real.js';

function test_tlv_encode_decode(a, cmp) {
  const buf = a.encode();
  const b = TLV.decode_from(new DataView(buf), 0)[0];
  const buf2 = b.encode();

  if (cmp) {
    assert(cmp(a.value, b.value));
  } else {
    assert_equal(a.value, b.value);
  }

  assert_equal(buf, buf2);
}

export function test_ber_encode_decode(a) {
  let tlv = a.encode();
  const buf = tlv.encode();
  tlv = TLV.decode_from(new DataView(buf), 0)[0];
  const b = a.constructor.decode(tlv);
  tlv = b.encode();
  const buf2 = tlv.encode();

  assert_equal(buf, buf2);
}

function test_float_split(v, [sign, exponent, mantissa]) {
  assert_equal(join_float64(sign, exponent, mantissa), v);
  assert_equal(join_float64(sign, exponent, mantissa), v);
}

export function testBer() {
  test_tlv_encode_decode(TLV.INTEGER(1));
  test_tlv_encode_decode(TLV.INTEGER(-1));
  test_tlv_encode_decode(TLV.INTEGER(0xff));
  test_tlv_encode_decode(TLV.INTEGER(-0xff));
  test_tlv_encode_decode(TLV.INTEGER(0xffff));
  test_tlv_encode_decode(TLV.INTEGER(-0xffff));
  test_tlv_encode_decode(TLV.INTEGER(0xffffff));
  test_tlv_encode_decode(TLV.INTEGER(-0xffffff));
  test_tlv_encode_decode(TLV.INTEGER(-0xffffffff));
  test_tlv_encode_decode(TLV.INTEGER(0xffffffff));

  if (HAS_BIGINT) {
    test_tlv_encode_decode(TLV.INTEGER(BigInt(1)), (a, b) => {
      return Number(a) === Number(b);
    });
  }

  if (typeof BigInt !== 'undefined') {
    test_tlv_encode_decode(
      TLV.INTEGER(BigInt(Number.MAX_SAFE_INTEGER) * BigInt(2))
    );
  }

  for (let i = 0; i < 53; i++) {
    test_tlv_encode_decode(TLV.INTEGER(Math.pow(2, i)));
    test_tlv_encode_decode(TLV.INTEGER(-Math.pow(2, i)));
  }

  test_tlv_encode_decode(TLV.INTEGER(Number.MAX_SAFE_INTEGER));
  test_tlv_encode_decode(TLV.INTEGER(Number.MIN_SAFE_INTEGER));

  test_tlv_encode_decode(TLV.UTF8STRING('hello'));
  test_tlv_encode_decode(TLV.NULL());
  test_tlv_encode_decode(TLV.SEQUENCE([TLV.INTEGER(1), TLV.INTEGER(2)]));
  test_tlv_encode_decode(TLV.SET([TLV.INTEGER(1), TLV.INTEGER(2)]));
  test_tlv_encode_decode(
    TLV.SET([TLV.INTEGER(1), undefined, TLV.INTEGER(2), undefined])
  );

  test_tlv_encode_decode(TLV.OCTETSTRING(new Uint8Array(13)));

  test_float_split(0.5, [0, -1, 1]);
  test_float_split(-0.5, [1, -1, 1]);
  test_float_split(2, [0, 1, 1]);
  test_float_split(Math.pow(2, 10), [0, 10, 1]);
  test_float_split(Math.pow(2, -10), [0, -10, 1]);

  // test subnormal float
  test_float_split(Number.MIN_VALUE, [0, -1074, 1]);

  // test 2^-52
  test_float_split(Number.EPSILON, [0, -52, 1]);

  // special floating point values
  test_tlv_encode_decode(TLV.REAL(NaN));
  test_tlv_encode_decode(TLV.REAL(0.0));
  test_tlv_encode_decode(TLV.REAL(-0.0));
  test_tlv_encode_decode(TLV.REAL(Infinity));
  test_tlv_encode_decode(TLV.REAL(-Infinity));

  test_tlv_encode_decode(TLV.REAL(Math.PI));
  test_tlv_encode_decode(TLV.REAL(Number.MIN_VALUE));
  test_tlv_encode_decode(TLV.REAL(Number.EPSILON));

  someFloats().forEach((f) => {
    test_tlv_encode_decode(TLV.REAL(f));
  });

  test_tlv_encode_decode(TLV.REAL(join_float64([0, 0, 0xff])));
  test_tlv_encode_decode(TLV.REAL(join_float64([0, 0, 0x1ff])));
  test_tlv_encode_decode(TLV.REAL(join_float64([0, 0, 0xffff])));
  test_tlv_encode_decode(TLV.REAL(join_float64([0, 0, 0xffffff])));
  test_tlv_encode_decode(TLV.REAL(join_float64([0, 0, 0xffffffff])));

  // relative OIDs
  test_tlv_encode_decode(TLV.UNIVERSAL(TYPE_RELATIVE_OID, [1, 2, 3, 4]));
  test_tlv_encode_decode(TLV.UNIVERSAL(TYPE_RELATIVE_OID, [127, 2, 3, 4]));
  test_tlv_encode_decode(TLV.UNIVERSAL(TYPE_RELATIVE_OID, [128, 2, 3, 4]));
  test_tlv_encode_decode(TLV.UNIVERSAL(TYPE_RELATIVE_OID, [129, 2, 3, 4]));
  test_tlv_encode_decode(TLV.UNIVERSAL(TYPE_RELATIVE_OID, [0xffff, 2, 3, 4]));
  test_tlv_encode_decode(TLV.UNIVERSAL(TYPE_RELATIVE_OID, [0xffffff, 2, 3, 4]));
  test_tlv_encode_decode(TLV.UNIVERSAL(TYPE_RELATIVE_OID, [0, 2, 3, 4]));
}
