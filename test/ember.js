import { test_ber_encode_decode } from './ber.js';
import { S101DecodeFrame } from '../src/s101.js';
import {
  emberRoot,
  emberCommand,
  emberRootElementCollection,
  emberQualifiedParameter,
  emberParameterContents,
} from '../src/ember/types.js';

import { assert_equal } from './helpers.js';

export function testEmber() {
  {
    const cmd = new emberCommand(['getDirectory']);
    const collection = new emberRootElementCollection([cmd]);
    const root = new emberRoot(collection);
    test_ber_encode_decode(cmd);
    test_ber_encode_decode(collection);
    test_ber_encode_decode(root);
  }

  {
    const reference = new Uint8Array(
      S101DecodeFrame(
        // prettier-ignore
        Uint8Array.from([
          0xfe, 0x00, 0x0e, 0x00, 0x01, 0xc0, 0x01, 0x02,
          0x1f, 0x02, 0x60, 0x0b, 0x6b, 0x09, 0xa0, 0x07,
          0x62, 0x05, 0xa0, 0x03, 0x02, 0x01, 0x20, 0xb4,
          0xec, 0xff,
        ]).buffer
      )
    );
    const cmd = new emberCommand(['getDirectory']);
    const collection = new emberRootElementCollection([cmd]);
    const root = new emberRoot(collection);
    const buf = root.encode().encode();
    const u8 = new Uint8Array(9 + buf.byteLength);
    u8.set([0, 0x0e, 0x00, 0x01, 0xc0, 0x01, 0x02, 31, 0x02], 0);
    u8.set(new Uint8Array(buf), 9);

    assert_equal(u8, reference);
  }
  {
    const result = emberQualifiedParameter.from({
      path: [1, 2, 3, 4],
      contents: new emberParameterContents({
        value: 'foo',
      }),
    });
    test_ber_encode_decode(result);
  }
}
