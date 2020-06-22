import { EmberConnection } from './ember.js';

export class WebSocketConnection extends EmberConnection {
  constructor(ws, ...args) {
    super(...args);
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

  write(buffer) {
    this.ws.send(buffer);
  }

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

  static connect(url, ...args) {
    if (!url) {
      url = 'ws://' + window.location.host;
    }
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.onopen = () => {
        ws.onerror = null;
        ws.onclose = null;

        resolve(new this(ws, ...args));
      };
      ws.onerror = ws.onclose = (err) => {
        reject(err || new Error('Closed'));
      };
    });
  }
}
