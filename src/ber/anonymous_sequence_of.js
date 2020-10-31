import { TYPE_SEQUENCE } from './constants.js';
import { TLV } from './tlv.js';

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
