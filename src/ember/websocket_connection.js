import { EmberConnection } from './connection.js';

/**
 * Ember+ WebSocket connection.
 */
export class WebSocketConnection extends EmberConnection {
  /**
   * Creates a ember+ websocket connection.
   *
   * @param {WebSocket} ws
   *    The WebSocket connection. Needs to be in open state.
   */
  constructor(ws) {

    if (!(ws instanceof WebSocket))
      throw new TypeError('Expected WebSocket.');

    if (ws.readyState !== WebSocket.OPEN)
      throw new Error('Expected WebSocket to be in OPEN state.');

    super();
    this.ws = ws;
    this._onerror = (err) => {
      this.teardown(err);
    };
    this._onclose = () => {
      this.close();
    };
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('error', this._onerror);
    ws.addEventListener('close', this._onclose);
    ws.addEventListener('message', (ev) => {
      try {
        this.receive(ev.data);
      } catch (err) {
        console.warn('Protocol error:', err);
        this.teardown(err);
      }
    });
  }

  /** @internal */
  write(buffer) {
    this.ws.send(buffer);
  }

  /**
   * Close this connection.
   */
  close() {
    super.close();
    try {
      this.ws.removeEventListener('error', this._onerror);
      this.ws.removeEventListener('close', this._onclose);
      this.ws.close();
    } catch (err) {
      console.warn(err);
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
