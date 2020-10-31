
export function relative_oid_encoded_length(identifiers) {
  if (!Array.isArray(identifiers))
    throw new TypeError('Expected Array<number>.');

  let length = 0;

  for (let i = 0; i < identifiers.length; i++) {
    let n = identifiers[i];

    if (!(n >= 0))
      throw new TypeError(
        'Relative OID entries need to be non-negative.'
      );

    do {
      length++;
      n >>= 7;
    } while (n !== 0);
  }

  return length;
}

export function relative_oid_encode(data, pos, identifiers) {
  for (let i = 0; i < identifiers.length; i++) {
    let n = identifiers[i];

    if (!(n >= 0))
      throw new TypeError(
        'Relative OID entries need to be non-negative.'
      );

    do {
      let b = n & 0x7f;

      // not last byte
      if (b !== n) b |= 0x80;

      data.setUint8(pos, b);
      pos++;

      n >>= 7;
    } while (n !== 0);
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
      if (i === length - 1) throw Error('Unterminated relative OID');
    }
  }
  return identifiers;
}
