export function octet_string_encoded_length(u8) {
  if (!(u8 instanceof Uint8Array))
    throw new TypeError('Expected instance of Uint8Array');

  return u8.length;
}

export function octet_string_encode(data, pos, u8) {
  const dstu8 = new Uint8Array(data.buffer, data.byteOffset + pos);
  dstu8.set(u8);
  return pos + u8.length;
}

export function octet_string_decode(data, pos, length) {
  return new Uint8Array(data.buffer, data.byteOffset + pos, length);
}
