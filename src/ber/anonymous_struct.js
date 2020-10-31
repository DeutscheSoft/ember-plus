import { StructBase } from './struct_base.js';
import { CLASS_UNIVERSAL, TYPE_SET } from './constants.js';

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
