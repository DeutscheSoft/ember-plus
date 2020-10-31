import { TLV } from './tlv.js';

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
