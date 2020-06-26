import { EmberConnection } from './connection.js';
import { createConnection } from 'net';

export class TCPConnection extends EmberConnection {
  constructor(socket) {
    super();
    this.socket = socket;
    socket.on('close', () => {
      if (this.isClosed()) return;
      this.close();
    });
    socket.on('data', (data) => {
      if (this.isClosed()) return;
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
      this.socket.destroy();
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
