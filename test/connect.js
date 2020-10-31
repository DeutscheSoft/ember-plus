import { TCPConnection } from '../src/index.js';
import { Device } from '../src/index.js';
import { argv, exit } from 'process';

async function testConnect(options) {
  const connection = await TCPConnection.connect(options);
  const device = new Device(connection);

  device.observeDirectory(device.root, (node) => {
    console.log('root: %o', node);
  });
}

const options = {
  host: argv[2],
  port: parseInt(argv[3]),
};

console.log('Connecting to', options);

testConnect(options).then(
  () => {
    console.log('Connected.');
    //exit(0);
  },
  (error) => {
    console.error(error);
    exit(1);
  }
);
