import { TCPConnection, Device, Parameter } from '../src/index.js';
import { argv, exit } from 'process';

async function connect(options) {
  const connection = await TCPConnection.connect(options);
  connection.batch = 1;
  const device = new Device(connection);

  const lastValues = new Map();

  const handleNode = (node) => {
    node.children.forEach((child) => {
      if (child instanceof Parameter) {
        const path = child.identifierPath.join('/');
        device.observeProperty(child, 'value', (value) => {
          if (value === lastValues.get(path)) return;
          lastValues.set(path, value);
          console.log('%o -> %o', path, value);
        });
      } else {
        device.observeDirectory(child, handleNode);
      }
    });
  };

  device.observeDirectory(device.root, handleNode);
}

const options = {
  host: argv[2],
  port: parseInt(argv[3]),
};

if (!(options.port > 0 && options.port <= 0xffff) ||
    !(typeof options.host === 'string' && options.host.length > 0)) {
  console.error('Usage: %s %s <IP> <PORT>', argv[0], argv[1]);
  exit(1);
}

console.log('Connecting to', options);

connect(options).then(
  () => {
    console.log('Connected.');
    //exit(0);
  },
  (error) => {
    console.error(error);
    exit(1);
  }
);
