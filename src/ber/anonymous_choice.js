import {
  TYPE_BOOLEAN,
  TYPE_INTEGER,
  TYPE_REAL,
  TYPE_UTF8STRING,
} from './constants.js';

import { TLV } from './tlv.js';

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

