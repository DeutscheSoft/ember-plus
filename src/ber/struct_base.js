import { TLV } from './tlv.js';

export function StructBase(identifier, properties) {
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
