import { S101EncodeFrame, S101FrameDecoder } from '../src/s101.js';
import { to_u8, assert_equal } from './helpers.js';

function test_s101_encode_decode_frame(src) {
  const decoder = new S101FrameDecoder();

  decoder.feed(S101EncodeFrame(src.buffer));

  const data = to_u8(decoder.parse());

  if (!data) {
    console.log('decode failed:', src, decoder);
  }

  assert_equal(data, src);
}

export function testS101() {
  test_s101_encode_decode_frame(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  test_s101_encode_decode_frame(
    Uint8Array.from([255, 0, 254, 0xf8, 5, 6, 7, 8, 9])
  );
}
