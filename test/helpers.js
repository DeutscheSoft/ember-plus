export function to_u8(buf) {
  if (ArrayBuffer.isView(buf)) {
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } else {
    return new Uint8Array(buf);
  }
}

export function is_equal(b1, b2) {
  return JSON.stringify(to_u8(b1)) === JSON.stringify(to_u8(b2));
}

let ok = 0;

export function assert_equal(b1, b2) {
  if (!is_equal(b1, b2)) {
    throw new Error('Mismatch after decode.');
  } else {
    ok++;
  }
}

export function report() {
  console.log('%d OK', ok);
}
