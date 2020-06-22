/*
 * S101 implementation
 */

const S101_BOF = 0xfe,
  S101_EOF = 0xff,
  S101_CE = 0xfd,
  S101_XOR = 0x20,
  S101_INV = 0xf8;

// prettier-ignore
const CRC_TABLE = Uint16Array.from([
  0x0000, 0x1189, 0x2312, 0x329b, 0x4624, 0x57ad, 0x6536, 0x74bf,
  0x8c48, 0x9dc1, 0xaf5a, 0xbed3, 0xca6c, 0xdbe5, 0xe97e, 0xf8f7,
  0x1081, 0x0108, 0x3393, 0x221a, 0x56a5, 0x472c, 0x75b7, 0x643e,
  0x9cc9, 0x8d40, 0xbfdb, 0xae52, 0xdaed, 0xcb64, 0xf9ff, 0xe876,
  0x2102, 0x308b, 0x0210, 0x1399, 0x6726, 0x76af, 0x4434, 0x55bd,
  0xad4a, 0xbcc3, 0x8e58, 0x9fd1, 0xeb6e, 0xfae7, 0xc87c, 0xd9f5,
  0x3183, 0x200a, 0x1291, 0x0318, 0x77a7, 0x662e, 0x54b5, 0x453c,
  0xbdcb, 0xac42, 0x9ed9, 0x8f50, 0xfbef, 0xea66, 0xd8fd, 0xc974,
  0x4204, 0x538d, 0x6116, 0x709f, 0x0420, 0x15a9, 0x2732, 0x36bb,
  0xce4c, 0xdfc5, 0xed5e, 0xfcd7, 0x8868, 0x99e1, 0xab7a, 0xbaf3,
  0x5285, 0x430c, 0x7197, 0x601e, 0x14a1, 0x0528, 0x37b3, 0x263a,
  0xdecd, 0xcf44, 0xfddf, 0xec56, 0x98e9, 0x8960, 0xbbfb, 0xaa72,
  0x6306, 0x728f, 0x4014, 0x519d, 0x2522, 0x34ab, 0x0630, 0x17b9,
  0xef4e, 0xfec7, 0xcc5c, 0xddd5, 0xa96a, 0xb8e3, 0x8a78, 0x9bf1,
  0x7387, 0x620e, 0x5095, 0x411c, 0x35a3, 0x242a, 0x16b1, 0x0738,
  0xffcf, 0xee46, 0xdcdd, 0xcd54, 0xb9eb, 0xa862, 0x9af9, 0x8b70,
  0x8408, 0x9581, 0xa71a, 0xb693, 0xc22c, 0xd3a5, 0xe13e, 0xf0b7,
  0x0840, 0x19c9, 0x2b52, 0x3adb, 0x4e64, 0x5fed, 0x6d76, 0x7cff,
  0x9489, 0x8500, 0xb79b, 0xa612, 0xd2ad, 0xc324, 0xf1bf, 0xe036,
  0x18c1, 0x0948, 0x3bd3, 0x2a5a, 0x5ee5, 0x4f6c, 0x7df7, 0x6c7e,
  0xa50a, 0xb483, 0x8618, 0x9791, 0xe32e, 0xf2a7, 0xc03c, 0xd1b5,
  0x2942, 0x38cb, 0x0a50, 0x1bd9, 0x6f66, 0x7eef, 0x4c74, 0x5dfd,
  0xb58b, 0xa402, 0x9699, 0x8710, 0xf3af, 0xe226, 0xd0bd, 0xc134,
  0x39c3, 0x284a, 0x1ad1, 0x0b58, 0x7fe7, 0x6e6e, 0x5cf5, 0x4d7c,
  0xc60c, 0xd785, 0xe51e, 0xf497, 0x8028, 0x91a1, 0xa33a, 0xb2b3,
  0x4a44, 0x5bcd, 0x6956, 0x78df, 0x0c60, 0x1de9, 0x2f72, 0x3efb,
  0xd68d, 0xc704, 0xf59f, 0xe416, 0x90a9, 0x8120, 0xb3bb, 0xa232,
  0x5ac5, 0x4b4c, 0x79d7, 0x685e, 0x1ce1, 0x0d68, 0x3ff3, 0x2e7a,
  0xe70e, 0xf687, 0xc41c, 0xd595, 0xa12a, 0xb0a3, 0x8238, 0x93b1,
  0x6b46, 0x7acf, 0x4854, 0x59dd, 0x2d62, 0x3ceb, 0x0e70, 0x1ff9,
  0xf78f, 0xe606, 0xd49d, 0xc514, 0xb1ab, 0xa022, 0x92b9, 0x8330,
  0x7bc7, 0x6a4e, 0x58d5, 0x495c, 0x3de3, 0x2c6a, 0x1ef1, 0x0f78,
]);

/**
 * Checks the CRC value of the input buffer.
 */
function calculate_crc(src) {
  let crc = 0xffff;

  for (let i = 0; i < src.length; i++) {
    crc = ((crc >> 8) ^ CRC_TABLE[(crc ^ src[i]) & 0xff]) & 0xffff;
  }

  return crc;
}

export class S101FrameDecoder {
  constructor() {
    this.pos = 0;
    this.a8 = null;
  }

  feed(buf) {
    if (!this.a8) {
      this.a8 = new Uint8Array(buf);
    } else {
      const length = this.a8.length - this.pos;
      const nbuf = new ArrayBuffer(buf.byteLength + length);
      const na8 = new Uint8Array(nbuf);

      na8.set(this.a8.subarray(this.pos));
      na8.set(new Uint8Array(buf), length);

      this.a8 = na8;
      this.pos = 0;
    }
  }

  /**
   * Returns a DataView of the next frame, or null if no full S101 frame is
   * contained in the buffer.
   */
  parse() {
    let pos = this.pos;
    let a8 = this.a8; // uint8array of our buffer

    if (a8 === null) return null;

    if (a8.length === pos) return null;

    if (a8[pos] !== S101_BOF)
      throw new Error('Expected decoder position to be at start of frame.');

    pos++;

    let end = a8.indexOf(S101_EOF, pos);

    if (end === -1) {
      return null;
    }

    // update parser state
    if (end === this.a8.length - 1) {
      this.a8 = null;
      this.pos = 0;
    } else {
      this.pos = end + 1;
    }

    // decide if we need to decode
    let count_ce = 0;

    for (let i = pos; i < end; i++) {
      if (a8[i] === S101_CE) {
        count_ce++;
      }
    }

    // length of actual data in the buffer (including crc)
    const data_length = end - pos - count_ce;

    // we found escaped characters, we need to escape them
    if (count_ce !== 0) {
      const tmp = new Uint8Array(end - pos - count_ce);

      for (let i = pos, j = 0; i < end; i++, j++) {
        if (a8[i] !== S101_CE) {
          tmp[j] = a8[i];
        } else {
          i++;
          tmp[j] = a8[i] ^ S101_XOR;
        }
      }

      a8 = tmp;
      pos = 0;
    }

    const crc = calculate_crc(a8.subarray(pos, pos + data_length));

    if (crc !== 0xf0b8) {
      throw new Error('CRC mismatch.');
    }

    return new DataView(a8.buffer, a8.byteOffset + pos, data_length - 2);
  }
}

export function S101DecodeFrame(buf) {
  const decoder = new S101FrameDecoder();
  decoder.feed(buf);

  const view = decoder.parse();

  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

/**
 * Returns an ArrayBuffer containing the encoded data.
 */
export function S101EncodeFrame(buf) {
  const src = new Uint8Array(buf);
  const crc = ~calculate_crc(src) & 0xffff;

  let length = 2 + src.length + 2;

  if ((crc & 0xff) >= S101_INV) length++;
  if (((crc >> 8) & 0xff) >= S101_INV) length++;

  for (let i = 0; i < src.length; i++) {
    if (src[i] >= S101_INV) length++;
  }

  const ret = new ArrayBuffer(length);
  const dst = new Uint8Array(ret);
  let pos = 0;

  if (length === 2 + src.length + 2) {
    dst[pos++] = S101_BOF;
    dst.set(src, pos);
    pos += src.length;
    dst[pos++] = crc & 0xff;
    dst[pos++] = crc >> 8;
    dst[pos++] = S101_EOF;
  } else {
    dst[pos++] = S101_BOF;

    for (let i = 0; i < src.length; i++) {
      if (src[i] < S101_INV) {
        dst[pos++] = src[i];
      } else {
        dst[pos++] = S101_CE;
        dst[pos++] = src[i] ^ S101_XOR;
      }
    }

    if ((crc & 0xff) >= S101_INV) {
      dst[pos++] = S101_CE;
      dst[pos++] = (crc & 0xff) ^ S101_XOR;
    } else {
      dst[pos++] = crc & 0xff;
    }

    if (crc >> 8 >= S101_INV) {
      dst[pos++] = S101_CE;
      dst[pos++] = (crc >> 8) ^ S101_XOR;
    } else {
      dst[pos++] = crc >> 8;
    }

    dst[pos++] = S101_EOF;
  }

  if (pos !== dst.length) throw new Error('Encoder error.');

  return ret;
}
