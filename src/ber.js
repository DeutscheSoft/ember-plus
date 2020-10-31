/*
 * Some subset of BER encoding needed for Ember+
 */

import {
  integer_encoded_length,
  integer_encode,
  integer_decode,
} from './ber/integer.js';
import { real_encoded_length, real_encode, real_decode } from './ber/real.js';

// there are more types but this is what ember+ uses
export const TYPE_EOC = 0,
  TYPE_BOOLEAN = 1,
  TYPE_INTEGER = 2,
  TYPE_BITSTRING = 3,
  TYPE_OCTETSTRING = 4,
  TYPE_NULL = 5,
  TYPE_OBJECT_ID = 6,
  TYPE_OBJECT_DESCRIPTOR = 7,
  TYPE_EXTERNAL = 8,
  TYPE_REAL = 9,
  TYPE_ENUMERATED = 10,
  TYPE_EMBEDDED_PDV = 11,
  TYPE_UTF8STRING = 12,
  TYPE_RELATIVE_OID = 13,
  TYPE_SEQUENCE = 14,
  TYPE_SET = 17;

const CLASS_UNIVERSAL = 0,
  CLASS_APPLICATION = 1,
  CLASS_CONTEXT = 2,
  CLASS_PRIVATE = 3;

const UINT32_MAX = 0xffffffff;
const UINT16_MAX = 0xffff;
const UINT8_MAX = 0xff;
const INT8_MAX = 0x7f;

const utf8decoder = new TextDecoder();
const utf8encoder = new TextEncoder();

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
        case TYPE_INTEGER: {
          return integer_encoded_length(this.value);
        }
        case TYPE_OCTETSTRING:
          throw new Error('FIXME');
        case TYPE_NULL:
          return 0;
        case TYPE_REAL:
          return real_encoded_length(this.value);
        case TYPE_UTF8STRING:
          return utf8encoder.encode(this.value).length;
        case TYPE_RELATIVE_OID: {
          let length = 0;
          const identifiers = this.value;

          if (!Array.isArray(identifiers))
            throw new TypeError('Expected Array<number>.');

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
          throw new Error('FIXME');
        case TYPE_NULL:
          return pos;
        case TYPE_REAL:
          return real_encode(data, pos, this.value);
        case TYPE_UTF8STRING:
          if (utf8encoder.encodeInto) {
            const dst = new Uint8Array(data.buffer, data.byteOffset + pos);
            pos += utf8encoder.encodeInto(value, dst).written;
          } else {
            const dst = utf8encoder.encode(value);
            const a8 = new Uint8Array(data.buffer, data.byteOffset + pos);
            a8.set(dst);
            pos += dst.length;
          }
          return pos;
        case TYPE_RELATIVE_OID: {
          const identifiers = this.value;

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

    if (pos !== length) throw new Error('Encoding offset mismatch.');

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
          if (!length) throw new Error('Bad length field for INTEGER.');

          const value = integer_decode(data, pos, length);
          pos += length;

          // FIXME: we could/should test if the encoding was shorted form

          return [new TLV(identifier, value), pos];
        }
        case TYPE_OCTETSTRING: {
          throw new Error('FIXME');
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
          const a8 = new Uint8Array(data.buffer, data.byteOffset + pos, length);
          pos += length;
          return [new TLV(identifier, utf8decoder.decode(a8)), pos];
        }
        case TYPE_RELATIVE_OID: {
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

/*
 * Ember+ specific type handling
 */

function StructBase(identifier, properties) {
  const property_names = Object.keys(properties);
  const property_types = Object.values(properties);

  identifier |= 32;

  return class {
    constructor(args) {
      if (Array.isArray(args)) {
        for (let i = 0; i < property_names.length; i++) {
          const name = property_names[i];
          this[name] = args[i];
        }
      } else if (typeof args === 'object') {
        for (let i = 0; i < property_names.length; i++) {
          const name = property_names[i];
          this[name] = args[name];
        }
      } else if (args === void 0) {
        for (let i = 0; i < property_names.length; i++) {
          const name = property_names[i];
          this[name] = void 0;
        }
      } else {
        throw new TypeError('Expected array or object.');
      }
    }

    encode() {
      const values = [];

      for (let i = 0; i < property_names.length; i++) {
        const name = property_names[i];
        const value = this[name];

        if (value === void 0) continue;

        const type = property_types[i];

        let tlv;

        if (typeof type === 'number') {
          tlv = TLV.UNIVERSAL(type, value);
        } else {
          tlv = type.encode(value);
        }

        values.push(TLV.CONTEXT(i, tlv));
      }

      const tlv = new TLV(identifier, values);

      return tlv;
    }

    static decode(tlv, cl) {
      const values = tlv.value;
      const args = new Array(property_names.length);

      if (tlv.identifier !== identifier) throw new Error('Type mismatch.');

      for (let i = 0; i < values.length; i++) {
        let ctlv = values[i];
        const idx = ctlv.context;

        const type = property_types[idx];

        ctlv = ctlv.context_value;

        if (typeof type === 'number') {
          if (type !== ctlv.type) throw new Error('Type mismatch.');
          args[idx] = ctlv.value;
        } else if (typeof type === 'function') {
          args[idx] = type.decode(ctlv);
        }
      }

      return args;
    }
  };
}

export function Struct(application_id, properties) {
  const Base = StructBase(
    application_id | (CLASS_APPLICATION << 6),
    properties
  );

  return class extends Base {
    static get application_id() {
      return application_id;
    }

    get application_id() {
      return application_id;
    }

    static encode(o) {
      return o.encode();
    }

    static decode(tlv) {
      return new this(Base.decode(tlv));
    }

    static from(o) {
      return new this(o);
    }
  };
}

export function AnonymousStruct(properties) {
  const Base = StructBase(TYPE_SET | (CLASS_UNIVERSAL << 6), properties);

  return class extends Base {
    static encode(o) {
      return o.encode();
    }

    static decode(tlv) {
      return new this(Base.decode(tlv));
    }
  };
}

export function AnonymousChoice(...types) {
  const universal_types = new Array(31).fill(false);
  const application_types = new Array(31);

  for (let i = 0; i < types.length; i++) {
    const type = types[i];

    if (typeof type === 'number') {
      universal_types[type] = true;
    } else {
      application_types[type.application_id] = type;
    }
  }

  return class {
    static encode(value) {
      if (
        typeof value === 'object' &&
        typeof value.application_id === 'number'
      ) {
        const type = application_types[value.application_id];

        if (type === void 0) throw new Error('Choice mismatch.');

        return type.encode(value);
      } else {
        // try to find the right universal type for encoding this value.

        switch (typeof value) {
          case 'string':
            if (!universal_types[TYPE_UTF8STRING]) break;
            return TLV.UTF8STRING(value);
          case 'number':
            if (
              universal_types[TYPE_INTEGER] &&
              isFinite(value) &&
              Math.round(value) === value
            )
              return TLV.INTEGER(value);

            if (universal_types[TYPE_REAL]) return TLV.REAL(value);
            break;
          case 'boolean':
            if (universal_types[TYPE_BOOLEAN]) return TLV.BOOLEAN(value);
            break;
        }

        throw new TypeError('Cannot enocde type.');
      }
    }

    static decode(tlv) {
      if (tlv.is_context) throw new Error('Context tag in Choice.');

      if (tlv.is_application) {
        const type = application_types[tlv.application];

        if (type === void 0) throw new Error('Choice mismatch.');

        return type.decode(tlv);
      } else {
        if (!universal_types[tlv.type]) throw new Error('Choice mismatch.');

        return tlv.value;
      }
    }
  };
}

export function Choice(application_id, ...types) {
  const Base = AnonymousChoice(...types);

  return class {
    constructor(value) {
      this.value = value;
    }

    encode() {
      return TLV.APPLICATION_CONSTRUCTED(application_id, [
        Base.encode(this.value),
      ]);
    }

    static encode(value) {
      return value.encode();
    }

    static decode(tlv) {
      if (tlv.application !== application_id)
        throw new Error('Application id mismatch.');

      return new this(Base.decode(tlv.application_value));
    }
  };
}

export function Enum(...names) {
  return class {
    static decode(tlv) {
      if (!tlv.is_universal) throw new Error('Enum should be universal.');

      if (tlv.type !== TYPE_INTEGER) throw new Error('Enum should be integer.');

      const name = names[tlv.value];

      if (name === void 0) throw new Error('Invalid enum entry.');

      return name;
    }

    static encode(name) {
      const idx = names.indexOf(name);

      if (idx === -1) throw new Error('Invalid enum entry.');

      return TLV.INTEGER(idx);
    }
  };
}

export function AnonymousSequenceOf(type) {
  return class {
    static decode(tlv) {
      if (!tlv.is_universal || tlv.type !== TYPE_SEQUENCE)
        throw new Error('Expected universal sequence.');

      return tlv.value.map((ctlv) => type.decode(ctlv));
    }

    static encode(list) {
      return TLV.SEQUENCE(list.map((v) => type.encode(v)));
    }

    static setType(_type) {
      type = _type;
    }
  };
}

export function SequenceOf(application_id, type) {
  return class {
    static get application_id() {
      return application_id;
    }

    get application_id() {
      return application_id;
    }

    constructor(list) {
      this.list = list;
    }

    encode() {
      const list = this.list;
      return TLV.APPLICATION_CONSTRUCTED(
        application_id,
        list.map((v) => TLV.CONTEXT(0, type.encode(v)))
      );
    }

    static decode(tlv) {
      if (tlv.application !== application_id)
        throw new Error('Unexpected application id.');

      return new this(
        tlv.value.map((ctlv) => {
          if (!ctlv.is_context) throw new Error('Expected tagged elements.');

          return type.decode(ctlv.value[0]);
        })
      );
    }

    static encode(list) {
      return list.encode();
    }

    static setType(_type) {
      type = _type;
    }
  };
}
