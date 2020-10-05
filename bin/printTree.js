import { TCPConnection, Device, Parameter } from '../src/index.js';

async function connect(options) {
  const connection = await TCPConnection.connect(options);
  const device = new Device(connection);

  const handleNode = (node) => {
    console.log('handleNode', node.identifierPath);
    node.children.forEach((child) => {
      if (child instanceof Parameter) {
        console.log('paramter %o', child.identifierPath);
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
