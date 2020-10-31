import {
  CLASS_UNIVERSAL,
  CLASS_APPLICATION,
  CLASS_CONTEXT,
  CLASS_PRIVATE,
  TYPE_EOC,
  TYPE_BOOLEAN,
  TYPE_INTEGER,
  TYPE_OCTETSTRING,
  TYPE_NULL,
  TYPE_REAL,
  TYPE_UTF8STRING,
  TYPE_RELATIVE_OID,
  TYPE_SEQUENCE,
  TYPE_SET,
} from './constants.js';

const UINT32_MAX = 0xffffffff;
const UINT16_MAX = 0xffff;
const UINT8_MAX = 0xff;
const INT8_MAX = 0x7f;

import {
  integer_encoded_length,
  integer_encode,
  integer_decode,
} from './integer.js';
import { real_encoded_length, real_encode, real_decode } from './real.js';
import {
  utf8_string_encoded_length,
  utf8_string_encode,
  utf8_string_decode,
} from './utf8_string.js';
import {
  relative_oid_encoded_length,
  relative_oid_encode,
  relative_oid_decode,
} from './relative_oid.js';
import {
  octet_string_encoded_length,
  octet_string_encode,
  octet_string_decode,
} from './octet_string.js';

function tlv_encode_length(data, pos, length) {
  if (length <= INT8_MAX) {
    data.setUint8(pos, length);
    pos++;
  } else if (length <= UINT8_MAX) {
    data.setUint8(pos, 128 | 2);
    pos++;
    data.setUint8(pos, length);
    pos++;
  } else if (length <= UINT16_MAX) {
    data.setUint8(pos, 128 | 2);
    pos++;
    data.setUint16(pos, length);
    pos += 2;
  } else if (length <= UINT32_MAX) {
    data.setUint8(pos, 128 | 4);
    pos++;
    data.setUint32(pos, length);
    pos += 4;
  } else throw new Error('Length overflow.');

  return pos;
}

function tlv_length_encoded_length(length) {
  if (length < 128) {
    return 1;
  } else if (length <= 0xff) {
    return 2;
  } else if (length <= 0xffff) {
    return 3;
  } else if (length <= 0xffffffff) {
    return 5;
  } else throw new Error('Length overflow.');
}

export class TLV {
  constructor(identifier, value) {
    this.identifier = identifier;
    this.value = value;
    this._length = -1;
  }

  get tag_class() {
    return this.identifier >> 6;
  }

  get type() {
    return this.identifier & 31;
  }

  get is_constructed() {
    return this.identifier & 32;
  }

  get is_universal() {
    return this.tag_class === CLASS_UNIVERSAL;
  }

  get is_application() {
    return this.tag_class === CLASS_APPLICATION;
  }

  get is_context() {
    return this.tag_class === CLASS_CONTEXT;
  }

  get is_private() {
    return this.tag_class === CLASS_PRIVATE;
  }

  get is_eoc() {
    return this.is_universal && this.type === TYPE_EOC;
  }

  get context() {
    if (!this.is_context) throw new Error('Not a context tag.');

    return this.type;
  }

  get application() {
    if (!this.is_application) throw new Error('Not an application tag.');

    return this.type;
  }

  get context_value() {
    if (!this.is_context) throw new Error('Not a context tag.');

    const value = this.value;

    if (!Array.isArray(value)) throw new Error('Expected constructed TLV.');

    if (value.length !== 1)
      throw new Error('Expected one child in context TLV.');

    return value[0];
  }

  get application_value() {
    if (!this.is_application) throw new Error('Not a application tag.');

    const value = this.value;

    if (!Array.isArray(value)) throw new Error('Expected constructed TLV.');

    if (value.length !== 1)
      throw new Error('Expected one child in application TLV.');

    return value[0];
  }

  encoded_length() {
    let length = this.length();

    length += tlv_length_encoded_length(length);
    length += 1; // tag

    return length;
  }

  length() {
    if (this._length === -1) this._length = this.calculate_length();

    return this._length;
  }

  calculate_length() {
    const type = this.type;

    if (this.is_constructed) {
      const value = this.value;
      let length = 0;

      for (let i = 0; i < value.length; i++) {
        const ctlv = value[i];

        if (ctlv === void 0) {
          if (type === TYPE_SET) continue;
          throw new Error('Undefined entry in non-set.');
        }

        length += value[i].encoded_length();
      }

      return length;
    } else if (this.is_universal)
      switch (this.type) {
        case TYPE_BOOLEAN:
          return 1;
        case TYPE_INTEGER:
          return integer_encoded_length(this.value);
        case TYPE_OCTETSTRING:
          return octet_string_encoded_length(this.value);
        case TYPE_NULL:
          return 0;
        case TYPE_REAL:
          return real_encoded_length(this.value);
        case TYPE_UTF8STRING:
          return utf8_string_encoded_length(this.value);
        case TYPE_RELATIVE_OID:
          return relative_oid_encoded_length(this.value);
        default:
          throw new Error('Unsupported type: ' + this.type);
      }
  }

  encode_to(data, pos) {
    const value = this.value;

    data.setUint8(pos, this.identifier);
    pos++;
    pos = tlv_encode_length(data, pos, this.length());

    if (this.is_constructed) {
      for (let i = 0; i < value.length; i++) {
        const ctlv = value[i];

        pos = ctlv.encode_to(data, pos);
      }

      return pos;
    } else if (this.is_universal)
      switch (this.type) {
        case TYPE_BOOLEAN:
          data.setUint8(pos, value ? 0xff : 0);
          return pos + 1;
        case TYPE_INTEGER:
          return integer_encode(data, pos, this.value);
        case TYPE_OCTETSTRING:
          return octet_string_encode(data, pos, this.value);
        case TYPE_NULL:
          return pos;
        case TYPE_REAL:
          return real_encode(data, pos, this.value);
        case TYPE_UTF8STRING:
          return utf8_string_encode(data, pos, this.value);
        case TYPE_RELATIVE_OID:
          return relative_oid_encode(data, pos, this.value);
        default:
          throw new Error('Unsupported primitive type.');
      }
    else {
      throw new Error('Unsupported tag type.');
    }
  }

  encode() {
    const length = this.encoded_length();
    const buf = new ArrayBuffer(length);

    const pos = this.encode_to(new DataView(buf), 0);

    if (pos !== length) {
      console.error('%O %d %d', this, pos, length);
      throw new Error('Encoding offset mismatch.');
    }

    return buf;
  }

  static decode_from(data, pos) {
    // read the tag
    const identifier = data.getUint8(pos);
    pos++;

    const tag_class = identifier >> 6;
    const constructed = !!(identifier & 32);

    let tag_number = identifier & 31;

    if (tag_number === 31) {
      tag_number = 0;
      let tmp;

      do {
        tmp = data.getUint8(pos);
        pos++;
        tag_number = (tag_number << 7) | (tmp & 0x7f);
      } while (tmp & 128);
    }

    // read the length

    let length = data.getUint8(pos);
    pos++;

    if (length === 128) {
      length = -1;
    } else if (length === 255) {
      throw new Error('Reserved value in length field.');
    } else if (length > 128) {
      const n = length & 127;
      length = 0;

      // do we want to special-case 1,2,4 ?

      for (let i = 0; i < n; i++, pos++) {
        length = (length << 8) | data.getUint8(pos);
      }
    }

    if (constructed) {
      const value = [];

      if (length === -1) {
        // indefinite length
        for (;;) {
          let ctlv;
          [ctlv, pos] = TLV.decode_from(data, pos);

          // done
          if (ctlv.is_eoc) {
            break;
          }

          value.push(ctlv);
        }
      } else {
        // definite length
        const end = pos + length;

        while (pos < end) {
          let ctlv;
          [ctlv, pos] = TLV.decode_from(data, pos);

          value.push(ctlv);
        }

        if (pos !== end) throw new Error('Bad length field in SEQUENCE.');
      }

      return [new TLV(identifier, value), pos];
    } else if (tag_class === CLASS_UNIVERSAL) {
      switch (tag_number) {
        case TYPE_EOC: {
          if (length !== 0) throw new Error('Bad length field for EOC.');

          return [new TLV(identifier, void 0), pos];
        }
        case TYPE_BOOLEAN: {
          if (length !== 1) throw new Error('Bad length field for BOOLEAN.');

          const value = data.getUint8(pos) !== 0;
          pos++;

          return [new TLV(identifier, value), pos];
        }
        case TYPE_INTEGER: {
          if (!(length > 0)) throw new Error('Bad length field for INTEGER.');

          const value = integer_decode(data, pos, length);
          pos += length;

          // FIXME: we could/should test if the encoding was shorted form

          return [new TLV(identifier, value), pos];
        }
        case TYPE_OCTETSTRING: {
          if (length === -1)
            throw new Error('Unsupported indefinite length octet string.');

          const u8 = octet_string_decode(data, pos, length);
          pos += length;

          return [new TLV(identifier, u8), pos];
        }
        case TYPE_NULL: {
          if (length) throw new Error('Bad length field for NULL.');

          return [new TLV(identifier, null), pos];
        }
        case TYPE_REAL: {
          if (length < 0) throw new Error('Bad length field for REAL.');

          const value = real_decode(data, pos, length);
          pos += length;

          return [new TLV(identifier, value), pos];
        }
        case TYPE_UTF8STRING: {
          if (!(length >= 0))
            throw new Error('Bad length field for UTF8STRING');
          const str = utf8_string_decode(data, pos, length);
          pos += length;
          return [new TLV(identifier, str), pos];
        }
        case TYPE_RELATIVE_OID: {
          if (!(length > 0))
            throw new Error('Bad length field for RELATIVE_OID');
          const identifiers = relative_oid_decode(data, pos, length);
          pos += length;
          return [new TLV(identifier, identifiers), pos];
        }
        default:
          throw new Error('Unsupported primitive type ' + tag_number);
      }
    } else {
      throw new Error('Unsupported class.');
    }
  }

  static UNIVERSAL(type, value) {
    return new this(type | (CLASS_UNIVERSAL << 6), value);
  }
  static UNIVERSAL_CONSTRUCTED(type, value) {
    return new this(type | (CLASS_UNIVERSAL << 6) | 32, value);
  }
  static INTEGER(v) {
    if (typeof v !== 'number' || !isFinite(v))
      throw new TypeError('Expected integer.');

    return this.UNIVERSAL(TYPE_INTEGER, v);
  }
  static BOOLEAN(v) {
    return this.UNIVERSAL(TYPE_BOOLEAN, v);
  }
  static OCTETSTRING(v) {
    return this.UNIVERSAL(TYPE_OCTETSTRING, v);
  }
  static NULL() {
    return this.UNIVERSAL(TYPE_NULL, null);
  }
  static REAL(v) {
    return this.UNIVERSAL(TYPE_REAL, v);
  }
  static UTF8STRING(v) {
    return this.UNIVERSAL(TYPE_UTF8STRING, v);
  }

  static SEQUENCE(v) {
    return this.UNIVERSAL_CONSTRUCTED(TYPE_SEQUENCE, v);
  }
  static SET(v) {
    const children = [];

    for (let i = 0; i < v.length; i++) {
      const tlv = v[i];

      if (tlv === void 0) continue;
      children.push(this.CONTEXT(i, tlv));
    }

    return this.UNIVERSAL_CONSTRUCTED(TYPE_SET, children);
  }

  static CONTEXT(n, child) {
    return new this(n | (CLASS_CONTEXT << 6) | 32, [child]);
  }
  static APPLICATION_CONSTRUCTED(n, children) {
    return new this(n | (CLASS_APPLICATION << 6) | 32, children);
  }
}
