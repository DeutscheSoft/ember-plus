import { TCPConnection, Device, Parameter } from '../src/index.js';

async function connect(options) {
  const connection = await TCPConnection.connect(options);
  connection.batch = 1;
  const device = new Device(connection);

  const handleNode = (node) => {
    node.children.forEach((child) => {
      if (child instanceof Parameter) {
        const path = child.identifierPath.join('/');
        device.observeProperty(child, 'value', (value) => {
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
  host: process.argv[2],
  port: parseInt(process.argv[3]),
};

console.log('Connecting to', options);

connect(options).then(
  () => {
    console.log('Connected.');
    //process.exit(0);
  },
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
