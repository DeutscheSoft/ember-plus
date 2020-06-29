import { TCPConnection } from '../src/index.js';
import { Device } from '../src/index.js';

async function testConnect(options) {
  const connection = await TCPConnection.connect(options);
  const device = new Device(connection);

  if (false)
    device.observePath('XCMC#1/InputChan#39/AuxBus#8/PreFader', (node) => {
      console.log('PreFader', node);
    });

  if (false)
    device.observePath('Local/RUI#1/Meter#1/Value#1', (node) => {
      console.log('Meter', node);
      return node.observeEffectiveValue((v) => {
        console.log('->', v);
      });
    });

  const sub = device.observePath('XCMC#1/InputChan#1/Label', (node) => {
    setTimeout(() => {
      console.log('Setting value');
      device.setValue(node, 'Foo');
      sub();
      setTimeout(() => {
        connection.close();
        console.log('Closed');
      }, 100);
    }, 2000);
    return node.observeEffectiveValue((v) => {
      console.log('label ->', v);
    });
  });
}

const options = {
  host: process.argv[2],
  port: parseInt(process.argv[3]),
};

console.log('Connecting to', options);

testConnect(options).then(
  () => {
    console.log('Connected.');
    //process.exit(0);
  },
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
