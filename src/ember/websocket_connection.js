import { Connection } from './connection.js';

/**
 * Ember+ WebSocket connection.
 */
export class WebSocketConnection extends Connection {
  /**
   * Creates a ember+ websocket connection.
   *
   * @param {WebSocket} ws
   *    The WebSocket connection. Needs to be in open state.
   */
  constructor(ws) {
    if (!(ws instanceof WebSocket)) throw new TypeError('Expected WebSocket.');

    if (ws.readyState !== WebSocket.OPEN)
      throw new Error('Expected WebSocket to be in OPEN state.');

    super();
    this.ws = ws;
    this._onerror = (err) => {
      this.teardown();
    };
    this._onclose = () => {
      this.teardown();
    };
    this._onmessage = (ev) => {
      try {
        this.receive(ev.data);
      } catch (err) {
        console.warn('Protocol error:', err);
        this.close(err);
      }
    };
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('error', this._onerror);
    ws.addEventListener('close', this._onclose);
    ws.addEventListener('message', this._onmessage);
  }

  /** @internal */
  write(buffer) {
    super.write(buffer);
    this.ws.send(buffer);
  }

  teardown() {
    super.teardown();

    const ws = this.ws;

    if (!ws) return;

    try {
      ws.removeEventListener('error', this._onerror);
      ws.removeEventListener('close', this._onclose);
      ws.removeEventListener('message', this._onmessage);
      ws.close();
    } catch (err) {
      console.warn(err);
    }
    this.ws = null;
  }

  /**
   * Close this connection.
   */
  close(error) {
    const ws = this.ws;

    super.close(error);

    if (error && ws) {
      try {
        ws.dispatchEvent(new CustomEvent('error', { detail: error }));
      } catch (err) {
        console.warn(err);
      }
    }
  }

  /**
   * Connect a WebSocket and create a connection.
   *
   * @param {string} [url]
   *    The websocket URL. Defaults to `"ws://" + window.location.host`.
   * @param {string|string[]} [protocols]
   */
  static connect(url, ...extra) {
    if (!url) {
      url = 'ws://' + window.location.host;
    }
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, ...extra);
      ws.onopen = () => {
        ws.onerror = null;
        ws.onclose = null;

        resolve(new this(ws));
      };
      ws.onerror = ws.onclose = (err) => {
        reject(err || new Error('Closed'));
      };
    });
  }
}
