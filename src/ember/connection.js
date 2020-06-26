import { S101FrameDecoder, S101EncodeFrame } from '../s101.js';
import {
  emberCommand,
  emberElementCollection,
  emberNode,
  emberParameter,
  emberQualifiedNode,
  emberQualifiedParameter,
  emberRoot,
  emberRootElementCollection,
} from './types.js';
import { TLV } from '../ber.js';

function toQualifiedNode(node) {
  if (node instanceof emberQualifiedNode) {
    return emberQualifiedNode.from({
      path: node.path,
    });
  } else if (node instanceof emberNode) {
    return emberQualifiedNode.from({
      path: [node.number],
    });
  }
}

export class EmberConnection {
  constructor() {
    this._frameDecoder = new S101FrameDecoder();
    this._fragments = null;
    this.onRootElement = null;
  }

  send(buf) {
    this.write(S101EncodeFrame(buf));
  }

  sendKeepaliveRequest() {
    const u8 = Uint8Array.from([0, 0x0e, 0x01, 0x01]);

    this.send(u8.buffer);
  }

  sendKeepaliveResponse() {
    const u8 = Uint8Array.from([0, 0x0e, 0x02, 0x01]);

    this.send(u8.buffer);
  }

  sendEmber(tlv) {
    const buf = tlv.encode();
    const u8 = new Uint8Array(9 + buf.byteLength);
    u8.set([0, 0x0e, 0x00, 0x01, 0xc0, 0x01, 0x02, 31, 0x02], 0);
    u8.set(new Uint8Array(buf), 9);

    this.send(u8.buffer);
  }

  sendRoot(rootElement) {
    const list = [];
    list.push(rootElement);
    const collection = new emberRootElementCollection(list);
    const root = new emberRoot(collection);
    this.sendEmber(root.encode());
  }

  sendGetDirectory(node) {
    const cmd = new emberCommand(['getDirectory']);
    let rootElement;

    if (node) {
      const qualifiedNode = toQualifiedNode(node);
      qualifiedNode.children = new emberElementCollection([cmd]);
      rootElement = qualifiedNode;
    } else {
      rootElement = cmd;
    }
    this.sendRoot(rootElement);
  }

  onMessage(data, pos) {
    try {
      while (pos < data.byteLength) {
        let tlv;
        [tlv, pos] = TLV.decode_from(data, pos);
        const root = emberRoot.decode(tlv);

        //console.log('Received message', root);

        root.value.list.forEach((element) => {
          if (this.onRootElement === null) {
            console.warn('Dropped root element %o', element);
          }

          try {
            this.onRootElement(element);
          } catch (error) {
            console.error(error);
          }
        });
      }
    } catch (error) {
      console.error('Error in onMessage', error);
    }
  }

  receive(buf) {
    this._frameDecoder.feed(buf);

    while (true) {
      let frame = this._frameDecoder.parse();

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
        this.sendKeepaliveResponse();
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
          if (!this._fragments) throw new Error('Have empty partition buffer.');
          this._fragments.push(
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
          this.onMessage(frame, pos);
          break;
        case 0x80: // multi-packet message start
          if (this._fragments)
            throw new Error('Still have non-empty partition buffer.');
          this._fragments = [
            new Uint8Array(
              frame.buffer,
              frame.byteOffset + pos,
              frame.byteLength - pos
            ),
          ];
          break;
        case 0x40: {
          // multi-packet message end
          if (!this._fragments) throw new Error('Have empty partition buffer.');
          this._fragments.push(
            new Uint8Array(
              frame.buffer,
              frame.byteOffset + pos,
              frame.byteLength - pos
            )
          );

          let length = 0;
          const fragments = this._fragments;
          this._fragments = null;

          for (let i = 0; i < fragments.length; i++)
            length += fragments[i].byteLength;

          const out = new ArrayBuffer(length);
          const o8 = new Uint8Array(out);

          for (let i = 0, pos = 0; i < fragments.length; i++) {
            const fragment = fragments[i];
            o8.set(fragment, pos);
            pos += fragment.byteLength;
          }

          this.onMessage(new DataView(out), 0);
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
