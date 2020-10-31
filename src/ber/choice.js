import { AnonymousChoice } from './anonymous_choice.js';
import { TLV } from './tlv.js';

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
