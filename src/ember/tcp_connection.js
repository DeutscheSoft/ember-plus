import { Connection } from './connection.js';
import { createConnection } from 'net';
import { performance } from 'perf_hooks';

/**
 * A Ember+ TCP Connection.
 */
export class TCPConnection extends Connection {
  /**
   * @param {net.Socket} socket
   *    The connected socket.
   */
  constructor(socket) {
    super();
    this.socket = socket;
    socket.on('close', () => {
      if (this.isClosed()) return;
      this.teardown();
    });
    socket.on('data', (data) => {
      if (this.isClosed()) return;
      try {
        this.receive(data.buffer);
      } catch (err) {
        console.warn('Protocol error:', err);
        this.close(err);
      }
    });
  }

  now() {
    return performance.now();
  }

  /** @internal */
  write(buffer) {
    super.write(buffer);
    this.socket.write(new Uint8Array(buffer));
  }

  teardown() {
    super.teardown();

    const socket = this.socket;

    if (socket === null) return;

    try {
      socket.destroy();
    } catch (err) {
      console.error(err);
    }
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
      let socket = null;
      socket = new createConnection(options, () => {
        socket.off('error', reject);
        resolve(new this(socket));
      });
      socket.on('error', reject);
    });
  }
}
