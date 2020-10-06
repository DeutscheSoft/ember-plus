import { EmberConnection } from './connection.js';
import { createConnection } from 'net';

/**
 * A Ember+ TCP Connection.
 */
export class TCPConnection extends EmberConnection {
  /**
   * @param {net.Socket} socket
   *    The connected socket.
   */
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

  /** @internal */
  write(buffer) {
    this.socket.write(new Uint8Array(buffer));
  }

  /**
   * Close this connection.
   */
  close() {
    super.close();
    try {
      this.socket.destroy();
    } catch (err) {}
  }

  /**
   * Connect to the host.
   *
   * @params {Object} options
   *    The destination options. This is passed as first parameter to
   *    `net.createConnection`.
   *
   * @returns {Promise<TCPConnection>
   */
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
