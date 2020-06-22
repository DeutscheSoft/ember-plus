import { TLV } from '../src/ber.js';
import { to_u8, assert_equal } from './helpers.js';

function test_tlv_encode_decode(a) {
  const buf = a.encode();
  const b = TLV.decode_from(new DataView(buf), 0)[0];
  const buf2 = b.encode();

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

function test_float_split_join(a) {
  const b = join_float64(...split_float64(a));
  if (a !== b) {
    throw new Error('Mismatch after decode.');
  } else {
    ok++;
  }
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
  test_tlv_encode_decode(TLV.UTF8STRING('hello'));
  test_tlv_encode_decode(TLV.NULL());
  test_tlv_encode_decode(TLV.SEQUENCE([TLV.INTEGER(1), TLV.INTEGER(2)]));
  test_tlv_encode_decode(TLV.SET([TLV.INTEGER(1), TLV.INTEGER(2)]));
  test_tlv_encode_decode(
    TLV.SET([TLV.INTEGER(1), undefined, TLV.INTEGER(2), undefined])
  );

  /*
  console.log(split_float64(Math.PI));
  console.log(split_float64(Math.pow(13, -12)));
  console.log(split_float64(-Math.PI));
  console.log(split_float64(-Math.pow(13, -12)));
  test_float_split_join(1.0);
  test_float_split_join(-1.0);
  test_float_split_join(Math.pow(13, -12));
  test_float_split_join(Math.pow(13, 12));
  test_float_split_join(Math.E);
  test_float_split_join(Math.PI);
  */

  /*
  test_tlv_encode_decode(TLV.REAL(1.0));
  test_tlv_encode_decode(TLV.REAL(Math.PI));
  test_tlv_encode_decode(TLV.REAL(NaN));
  test_tlv_encode_decode(TLV.REAL(0.0));
  test_tlv_encode_decode(TLV.REAL(Infinity));
  test_tlv_encode_decode(TLV.REAL(-Infinity));
  */
}
