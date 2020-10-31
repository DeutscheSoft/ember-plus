import { TLV } from '../src/ber/tlv.js';
import { someFloats } from './float64.js';
import { assert_equal } from './helpers.js';

function test_tlv_encode_decode(a) {
  const buf = a.encode();
  const b = TLV.decode_from(new DataView(buf), 0)[0];
  const buf2 = b.encode();

  assert_equal(a.value, b.value);

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

  for (let i = 0; i < 53; i++) {
    test_tlv_encode_decode(TLV.INTEGER(Math.pow(2, i)));
    test_tlv_encode_decode(TLV.INTEGER(-Math.pow(2, i)));
  }

  test_tlv_encode_decode(TLV.INTEGER(4503599627370496));

  test_tlv_encode_decode(TLV.UTF8STRING('hello'));
  test_tlv_encode_decode(TLV.NULL());
  test_tlv_encode_decode(TLV.SEQUENCE([TLV.INTEGER(1), TLV.INTEGER(2)]));
  test_tlv_encode_decode(TLV.SET([TLV.INTEGER(1), TLV.INTEGER(2)]));
  test_tlv_encode_decode(
    TLV.SET([TLV.INTEGER(1), undefined, TLV.INTEGER(2), undefined])
  );

  test_tlv_encode_decode(TLV.OCTETSTRING(new Uint8Array(13)));

  // special floating point values
  test_tlv_encode_decode(TLV.REAL(Math.PI));
  test_tlv_encode_decode(TLV.REAL(NaN));
  test_tlv_encode_decode(TLV.REAL(0.0));
  test_tlv_encode_decode(TLV.REAL(-0.0));
  test_tlv_encode_decode(TLV.REAL(Infinity));
  test_tlv_encode_decode(TLV.REAL(-Infinity));

  someFloats().forEach((f) => {
    test_tlv_encode_decode(TLV.REAL(f));
  });
}
