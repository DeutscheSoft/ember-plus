import { TCPConnection } from '../src/index.js';

async function testConnect(options) {
  const connection = await TCPConnection.connect(options);

  //console.log('connected', connection);

  connection.send_keepalive_request();
  connection.send_get_directory();
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
