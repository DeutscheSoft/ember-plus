import { StructBase } from './struct_base.js';
import { CLASS_APPLICATION } from './constants.js';

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
