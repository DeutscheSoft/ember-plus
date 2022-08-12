export function relative_oid_encoded_length(identifiers) {
  if (!Array.isArray(identifiers))
    throw new TypeError('Expected Array<number>.');

  let length = 0;

  for (let i = 0; i < identifiers.length; i++) {
    let n = identifiers[i];

    if (!(n >= 0))
      throw new TypeError('Relative OID entries need to be non-negative.');

    do {
      length++;
      n >>= 7;
    } while (n !== 0);
  }

  return length;
}

export function relative_oid_encode(data, pos, identifiers) {
  for (let i = 0; i < identifiers.length; i++) {
    const n = identifiers[i];

    if (!(n >= 0))
      throw new TypeError('Relative OID entries need to be non-negative.');

    const bits = 32 - Math.clz32(n);
    const bytes = ((bits + 6) / 7) | 0;

    switch (bytes) {
      case 5:
        data.setUint8(pos++, 0x80 | ((n >>> (4 * 7)) & 0x7f));
      /* FALLTHROUGH */
      case 4:
        data.setUint8(pos++, 0x80 | ((n >>> (3 * 7)) & 0x7f));
      /* FALLTHROUGH */
      case 3:
        data.setUint8(pos++, 0x80 | ((n >>> (2 * 7)) & 0x7f));
      /* FALLTHROUGH */
      case 2:
        data.setUint8(pos++, 0x80 | ((n >>> 7) & 0x7f));
      /* FALLTHROUGH */
      case 1:
      case 0:
        data.setUint8(pos++, n & 0x7f);
    }
  }

  return pos;
}

export function relative_oid_decode(data, pos, length) {
  const a8 = new Uint8Array(data.buffer, data.byteOffset + pos, length);
  const identifiers = [];
  for (let acc = 0, i = 0; i < length; i++) {
    const b = a8[i];

    acc <<= 7;
    acc |= b & 0x7f;

    if ((b & 0x80) === 0) {
      identifiers.push(acc);
      acc = 0;
    } else {
      if (i === length - 1) throw Error('Unterminated relative OID.');
    }
  }
  return identifiers;
}
