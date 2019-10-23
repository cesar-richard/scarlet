const { NFC, KEY_TYPE_A, KEY_TYPE_B } = require('nfc-pcsc');

const PORT = process.env.SOCKETPORT || 3001;
const io = require('socket.io')(PORT);
const Sentry = require('@sentry/node');
const logger = require('./logger');

Sentry.init({ dsn: 'https://84064b30c0fe49abb7feb8baea032ca9@sentry.io/1793383' });

const nfc = new NFC(logger);
const nfcState = {
  reader: null,
  connected: false,
  mode: 'reader',
};
const ereaseWallet = (reader) => {
  nfcState.mode = 'reader';
  logger.info('client is requesting Wallet ereasing');
  const block = 28;
  reader.authenticate(block, KEY_TYPE_A, 'KEY_A')
    .then((data) => {
      logger.info(`Auth A OK  ${data}`);
      reader.authenticate(block, KEY_TYPE_B, 'KEY_B').then((data2) => {
        logger.info(`AUTH B OK ${data2}`);
        const binary = Buffer.allocUnsafe(16);
        binary.fill(0);
        reader.write(block, binary, binary.length)
          .then((dataB) => {
            logger.info(`Write ${dataB}`);
            reader.read(block, 16)
              .then((dataAB) => logger.info(`Post write read ${dataAB}`))
              .catch((err3) => logger.error(`yo read ${err3}`));
          })
          .catch((err2) => logger.error(`Error writing wallet ${err2}`));
      }).catch(logger.error);
    })
    .catch((err) => logger.error(`AUTH A ERR ${err}`));
};

logger.info('Listening on port ', PORT);

nfc.on('reader', (reader) => {
  logger.info(`${reader.reader.name}  device attached`);
  nfcState.connected = true;
  nfcState.reader = reader.reader;
  io.emit('start', reader.reader.name);
  // enable when you want to auto-process ISO 14443-4 tags (standard=TAG_ISO_14443_4)
  // when an ISO 14443-4 is detected, SELECT FILE command with the AID is issued
  // the response is available as card.data in the card event
  // see examples/basic.js line 17 for more info
  // reader.aid = 'F222222222';

  reader.on('card', (card) => {
    // card is object containing following data
    // [always] String type: TAG_ISO_14443_3 (standard nfc tags like MIFARE)
    // or TAG_ISO_14443_4 (Android HCE and others)
    // [always] String standard: same as type
    // [only TAG_ISO_14443_3] String uid: tag uid
    // [only TAG_ISO_14443_4] Buffer data: raw data from select APDU response
    if (nfcState.mode === 'erease') {
      ereaseWallet(reader);
    }
    io.emit('card', card);
    logger.info(`${reader.reader.name}  card detected`, card);
  });

  reader.on('card.off', (card) => {
    io.emit('off', card);
    logger.info(`${reader.reader.name}  card removed`, card);
  });

  reader.on('error', (err) => {
    io.emit('error', err.toString());
    logger.error(`READER ${reader.reader.name} an error occurred`, err.toString());
  });

  reader.on('end', () => {
    nfcState.connected = false;
    nfcState.reader = null;
    io.emit('end');
    logger.info(`${reader.reader.name}  device removed`);
  });
});

nfc.on('nfcerror', (err) => {
  io.emit('error', err.toString());
  logger.error('an error occurred', err.toString());
});

io.on('connection', (client) => {
  logger.info('client connected');
  if (nfcState.connected) {
    io.emit('start', nfcState.reader.name);
  } else {
    io.emit('end');
  }
  client.on('subscribeToNFC', () => {
    logger.info('client is subscribing to NFC events');
  });
  client.on('ereaseWallet', () => {
    nfcState.mode = 'erease';
  });
});
