import { EmberConnection } from './ember.js';
import { createConnection } from 'net';

export class TCPConnection extends EmberConnection {
  constructor(socket) {
    super();
    this.socket = socket;
    this._onerror = (err) => {
      this.teardown(err);
    };
    this._onclose = () => {
      this.close();
    };
    socket.on('close', () => {
      this.close();
    });
    socket.on('data', (data) => {
      try {
        this.receive(data.buffer);
      } catch (err) {
        console.warn('Protocol error:', err);
        this.teardown(err);
      }
    });
  }

  write(buffer) {
    this.socket.write(new Uint8Array(buffer));
  }

  close() {
    super.close();
    try {
      this.socket.close();
    } catch (err) {}
  }

  static connect(options) {
    return new Promise((resolve, reject) => {
      let socket;
      socket = new createConnection(options, () => {
        socket.off('error', reject);
        resolve(new this(socket));
      });
      socket.on('error', reject);
    });
  }
}
