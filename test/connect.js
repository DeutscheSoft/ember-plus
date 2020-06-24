import { TCPConnection } from '../src/index.js';
import { Device } from '../src/index.js';

async function testConnect(options) {
  const connection = await TCPConnection.connect(options);

  const device = new Device(connection);
  console.log('connected', device);
}

const options = {
  host: '192.168.0.105',
  port: 9000,
};

testConnect(options).then(
  () => {
    console.log('OK');
    //process.exit(0);
  },
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
