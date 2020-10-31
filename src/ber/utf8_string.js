const utf8decoder = new TextDecoder();
const utf8encoder = new TextEncoder();

export function utf8_string_encoded_length(str) {
  return utf8encoder.encode(str).length;
}

export function utf8_string_encode(data, pos, str) {
  if (utf8encoder.encodeInto) {
    const dst = new Uint8Array(data.buffer, data.byteOffset + pos);
    pos += utf8encoder.encodeInto(str, dst).written;
  } else {
    const dst = utf8encoder.encode(str);
    const a8 = new Uint8Array(data.buffer, data.byteOffset + pos);
    a8.set(dst);
    pos += dst.length;
  }

  return pos;
}

export function utf8_string_decode(data, pos, length) {
  const a8 = new Uint8Array(data.buffer, data.byteOffset + pos, length);
  return utf8decoder.decode(a8);
}

