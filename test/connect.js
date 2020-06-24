import { TCPConnection } from '../src/index.js';
import { Device } from '../src/index.js';

async function testConnect(options) {
  const connection = await TCPConnection.connect(options);

  const device = new Device(connection);
  console.log('connected', device);
}

const options = {
  host: process.argv[2],
  port: parseInt(process.argv[3]),
};

console.log('options', options);

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
