import { S101FrameDecoder, S101EncodeFrame } from './s101.js';
import {
  AnonymousChoice,
  AnonymousStruct,
  Choice,
  Enum,
  SequenceOf,
  Struct,
  TLV,
  TYPE_BOOLEAN,
  TYPE_INTEGER,
  TYPE_REAL,
  TYPE_RELATIVE_OID,
  TYPE_OCTETSTRING,
  TYPE_UTF8STRING,
} from './ber.js';

const EMBER_ROOT = 0,
  EMBER_PARAMETER = 1,
  EMBER_COMMAND = 2,
  EMBER_NODE = 3,
  EMBER_ELEMENT_COLLECTION = 4,
  EMBER_STREAM_COLLECTION = 5,
  EMBER_STREAM_ENTRY = 6,
  EMBER_STRING_INTEGER_PAIR = 7,
  EMBER_STRING_INTEGER_COLLECTION = 8,
  EMBER_QUALIFIED_PARAMETER = 9,
  EMBER_QUALIFIED_NODE = 10,
  EMBER_ROOT_ELEMENT_COLLECTION = 11;

const emberValue = AnonymousChoice(
  TYPE_INTEGER,
  TYPE_REAL,
  TYPE_UTF8STRING,
  TYPE_BOOLEAN,
  TYPE_OCTETSTRING
);
const emberMinMax = AnonymousChoice(TYPE_INTEGER, TYPE_REAL);
const emberParameterType = Enum(
  'integer',
  'real',
  'string',
  'boolean',
  'trigger',
  'enum',
  'octets'
);
const emberParameterAccess = Enum('none', 'read', 'write', 'readWrite');
const emberStreamFormat = Enum(
  'unsignedInt8',
  void 0,
  'unsignedInt16BigEndian',
  'unsignedInt16LittleEndian',
  'unsignedInt32BigEndian',
  'unsignedInt32LittleEndian',
  'unsignedInt64BigEndian',
  'unsignedInt64LittleEndian',
  'signedInt8',
  void 0,
  'signedInt16BigEndian',
  'signedInt16LittleEndian',
  'signedInt32BigEndian',
  'signedInt32LittleEndian',
  'signedInt64BigEndian',
  'signedInt64LittleEndian',
  void 0,
  void 0,
  void 0,
  void 0,
  'ieeeFloat32BigEndian',
  'ieeeFloat32LittleEndian',
  'ieeeFloat64BigEndian',
  'ieeeFloat64LittleEndia'
);
const emberCommandType = Enum.apply(
  this,
  new Array(30).concat(['subscribe', 'unsubstribe', 'getDirectory'])
);

const emberNodeContents = AnonymousStruct({
  identifier: TYPE_UTF8STRING,
  description: TYPE_UTF8STRING,
  isRoot: TYPE_BOOLEAN,
  isOnline: TYPE_BOOLEAN, // FIXME: default = true
});

export class emberCommand extends Struct(2, {
  number: emberCommandType,
  options: TYPE_INTEGER,
}) {}

const emberStringIntegerPair = Struct(7, {
  entryString: TYPE_UTF8STRING,
  entryInteger: TYPE_INTEGER,
});

const emberStringIntegerCollection = SequenceOf(8, emberStringIntegerPair);

const emberStreamDescription = Struct(12, {
  format: emberStreamFormat,
  offset: TYPE_INTEGER,
});

const emberParameterContents = AnonymousStruct({
  identifier: TYPE_UTF8STRING,
  description: TYPE_UTF8STRING,
  value: emberValue,
  minimum: emberMinMax,
  maximum: emberMinMax,
  access: emberParameterAccess,
  format: TYPE_UTF8STRING,
  enumeration: TYPE_UTF8STRING,
  factor: TYPE_INTEGER,
  isOnline: TYPE_BOOLEAN,
  formula: TYPE_UTF8STRING,
  step: TYPE_INTEGER,
  default: emberValue,
  type: emberParameterType,
  streamIdentifier: TYPE_INTEGER,
  enumMap: emberStringIntegerCollection,
  streamDescriptor: emberStreamDescription,
});

class emberElementCollection extends SequenceOf(4, null) {}

export class emberParameter extends Struct(1, {
  number: TYPE_INTEGER,
  contents: emberParameterContents,
  children: emberElementCollection,
}) {}

export class emberQualifiedParameter extends Struct(9, {
  path: TYPE_RELATIVE_OID,
  contents: emberParameterContents,
  children: emberElementCollection,
}) {}

export class emberQualifiedNode extends Struct(10, {
  path: TYPE_RELATIVE_OID,
  contents: emberNodeContents,
  children: emberElementCollection,
}) {}

export class emberNode extends Struct(3, {
  number: TYPE_INTEGER,
  contents: emberNodeContents,
  children: emberElementCollection,
}) {}

const emberElement = AnonymousChoice(emberParameter, emberNode, emberCommand); // TODO: also matrix
emberElementCollection.setType(emberElement);

const emberRootElement = AnonymousChoice(
  emberParameter,
  emberNode,
  emberCommand,
  emberQualifiedParameter,
  emberQualifiedNode
); // TODO: also matrix
export const emberRootElementCollection = SequenceOf(11, emberRootElement);

const emberStreamEntry = Struct(5, {
  streamIdentifier: TYPE_INTEGER,
  streamValue: emberValue,
});

const emberStreamCollection = SequenceOf(6, emberStreamEntry);

export class emberRoot extends Choice(
  0,
  emberRootElementCollection,
  emberStreamCollection
) {}

/*
 * Connection handling.
 */

export class EmberConnection {
  constructor() {
    this.frame_decoder = new S101FrameDecoder();
    this.fragments = null;
    this.onerror = null;
    this.onclose = null;
    this.onmessage = null;
  }

  send(buf) {
    this.write(S101EncodeFrame(buf));
  }

  send_keepalive_request() {
    const u8 = Uint8Array.from([0, 0x0e, 0x01, 0x01]);

    this.send(u8.buffer);
  }

  send_keepalive_response() {
    const u8 = Uint8Array.from([0, 0x0e, 0x02, 0x01]);

    this.send(u8.buffer);
  }

  send_ember(tlv) {
    const buf = tlv.encode();
    const u8 = new Uint8Array(9 + buf.byteLength);
    u8.set([0, 0x0e, 0x00, 0x01, 0xc0, 0x01, 0x02, 31, 0x02], 0);
    u8.set(new Uint8Array(buf), 9);

    console.log('Send', tlv);

    this.send(u8.buffer);
  }

  send_get_directory() {
    const cmd = new emberCommand('getDirectory');
    const collection = new emberRootElementCollection([cmd]);
    const root = new emberRoot(collection);

    this.send_ember(root.encode());
  }

  handle_message(data, pos) {
    //console.log('message %o %o', data, pos);
    while (pos < data.byteLength) {
      let tlv;
      [tlv, pos] = TLV.decode_from(data, pos);
      console.log('Receive', tlv);
      const root = emberRoot.decode(tlv);
      console.log('root', root);
    }
  }

  receive(buf) {
    this.frame_decoder.feed(buf);

    while (true) {
      let frame = this.frame_decoder.parse();

      if (frame === null) break;

      let pos = 0;
      const slot = frame.getUint8(pos++);
      const message = frame.getUint8(pos++);
      const command = frame.getUint8(pos++);
      const version = frame.getUint8(pos++);

      if (slot !== 0) throw new Error('Expected slot 0.');

      if (message !== 0x0e) throw new Error('Expected Ember message.');

      if (version !== 1) throw new Error('Unsupported Ember version.');

      if (command === 1) {
        this.send_keepalive_response();
        continue;
      }

      if (command === 2) {
        // handle keepalive received.
        continue;
      }

      if (command !== 0) throw new Error('Unsupported command type.');

      const flags = frame.getUint8(pos++);
      const dtd = frame.getUint8(pos++);
      const app_bytes = frame.getUint8(pos++);

      if (app_bytes !== 2) throw new Error('Unexpected number of app bytes.');

      pos += app_bytes;

      switch (flags) {
        case 0x00: // multi-message packet
          if (!this.fragments) throw new Error('Have empty partition buffer.');
          this.fragments.push(
            new Uint8Array(
              frame.buffer,
              frame.byteOffset + pos,
              frame.byteLength - pos
            )
          );
          break;
        case 0x20: // empty packet
          break;
        case 0xc0:
          this.handle_message(frame, pos);
          break;
        case 0x80: // multi-packet message start
          if (this.fragments)
            throw new Error('Still have non-empty partition buffer.');
          this.fragments = [
            new Uint8Array(
              frame.buffer,
              frame.byteOffset + pos,
              frame.byteLength - pos
            ),
          ];
          break;
        case 0x40: {
          // multi-packet message end
          if (!this.fragments) throw new Error('Have empty partition buffer.');
          this.fragments.push(
            new Uint8Array(
              frame.buffer,
              frame.byteOffset + pos,
              frame.byteLength - pos
            )
          );

          let length = 0;
          const fragments = this.fragments;
          this.fragments = null;

          for (let i = 0; i < fragments.length; i++)
            length += fragments[i].byteLength;

          const out = new ArrayBuffer(length);
          const o8 = new Uint8Array(out);

          for (let i = 0, pos = 0; i < fragments.length; i++) {
            const fragment = fragments[i];
            o8.set(fragment, pos);
            pos += fragment.byteLength;
          }

          this.handle_message(new DataView(out), 0);
          break;
        }
        default:
          throw new Error('Unexpected flags value.');
      }
    }
  }

  teardown(err) {
    if (this.onerror) {
      try {
        this.onerror(err);
      } catch (e) {
        console.error(e);
      }
    }
    this.close();
  }

  close() {
    if (this.onclose) {
      try {
        this.onclose();
      } catch (e) {
        console.error(e);
      }
    }
  }
}
