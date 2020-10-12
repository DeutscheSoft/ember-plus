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
  } else {
    throw new TypeError('Expected node.');
  }
}

function toQualifiedElement(node) {
  if (node instanceof emberQualifiedNode) {
    return emberQualifiedNode.from({
      path: node.path,
    });
  } else if (node instanceof emberQualifiedParameter) {
    return emberQualifiedParameter.from({
      path: node.path,
    });
  } else {
    throw new TypeError('Expected qualifiedElement.');
  }
}

function dispatch(cb) {
  Promise.resolve().then(() => {
    try {
      cb();
    } catch (error) {
      console.error('Error in dispatch:', error);
    }
  });
}

function encodeEmberFrame(tlv) {
  const buf = tlv.encode();
  const u8 = new Uint8Array(9 + buf.byteLength);
  u8.set([0, 0x0e, 0x00, 0x01, 0xc0, 0x01, 0x02, 31, 0x02], 0);
  u8.set(new Uint8Array(buf), 9);

  return S101EncodeFrame(u8.buffer);
}


export class EmberConnection {
  set onRootElements(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Expected function.');
    }
    this._onRootElements = callback;
  }

  get onRootElements() {
    return this._onRootElements;
  }

  now() {
    return performance.now();
  }

  constructor() {
    this._frameDecoder = new S101FrameDecoder();
    this._fragments = null;
    this._rootElements = [];
    this.batch = 5;
    this._onRootElements = null;
    this._txTime = this.now();
    this._keepAliveID = -1;
  }

  clearKeepaliveInterval() {
    const id = this._keepAliveID;

    if (id === -1) return;
    this._keepAliveID = -1;
    clearInterval(id);
  }

  _triggerKeepalive(time) {
    if (this.now() - this._txTime >= time)
      this.sendKeepaliveRequest();
  }

  setKeepaliveInterval(time) {
    if (!(time > 0))
      throw new TypeError('Expected time interval.');
    this.clearKeepaliveInterval();
    this._keepAliveID = setInterval(() => {
      this._triggerKeepalive(time);
    }, time / 2);
  }

  write(buf) {
    this._txTime = this.now();
    console.log('written %d bytes.', buf.byteLength);
  }

  sendKeepaliveRequest() {
    const u8 = Uint8Array.from([0, 0x0e, 0x01, 0x01]);

    this.write(S101EncodeFrame(u8.buffer));
  }

  sendKeepaliveResponse() {
    const u8 = Uint8Array.from([0, 0x0e, 0x02, 0x01]);

    this.write(S101EncodeFrame(u8.buffer));
  }

  flushRoot() {
    const rootElements = this._rootElements;
    const N = this.batch;
    const frames = [];

    for (let i = 0; i < rootElements.length; i += N) {
      const list = rootElements.slice(i, i + N);
      const collection = new emberRootElementCollection(list);
      const root = new emberRoot(collection);
      frames.push(encodeEmberFrame(root.encode()));
    }
    rootElements.length = 0;

    if (!frames.length) return;

    if (frames.length === 1) {
      this.write(frames[0]);
    } else {
      const length = frames.reduce((length, buffer) => length + buffer.byteLength, 0);
      const buffer = new ArrayBuffer(length);
      const a8 = new Uint8Array(buffer);

      for (let i = 0, pos = 0; i < frames.length; i++) {
        const chunk = new Uint8Array(frames[i]);
        a8.set(chunk, pos);
        pos += chunk.length;
      }

      this.write(buffer);
    }
  }

  sendRoot(rootElement) {
    const list = this._rootElements;
    list.push(rootElement);
    if (list.length !== 1) return;
    dispatch(() => {
      if (this.isClosed()) return;
      this.flushRoot();
    });
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

  sendUnsubscribe(node) {
    const cmd = new emberCommand(['unsubscribe']);
    const qualifiedElement = toQualifiedElement(node);
    qualifiedElement.children = new emberElementCollection([cmd]);

    this.sendRoot(qualifiedElement);
  }

  onMessage(data, pos) {
    try {
      while (pos < data.byteLength) {
        let tlv;
        [tlv, pos] = TLV.decode_from(data, pos);
        const root = emberRoot.decode(tlv);

        if (this.onRootElements === null) {
          console.warn('Dropped root element %o', element);
        }

        try {
          this.onRootElements(root.value.list);
        } catch (error) {
          console.error(error);
        }
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
    this.clearKeepaliveInterval();
    this.close();
  }

  close() {
    this._frameDecoder = null;
  }

  isClosed() {
    return this._frameDecoder === null;
  }
}
