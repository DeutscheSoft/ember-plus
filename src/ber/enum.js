import { TYPE_INTEGER } from './constants.js';
import { TLV } from './tlv.js';

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
