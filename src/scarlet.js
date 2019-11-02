const { NFC, KEY_TYPE_A, KEY_TYPE_B } = require('nfc-pcsc');

const PORT = process.env.SOCKETPORT || 3001;
const io = require('socket.io')(PORT);
const Sentry = require('@sentry/node');
const logger = require('./logger');

Sentry.init({ dsn: 'https://84064b30c0fe49abb7feb8baea032ca9@sentry.io/1793383' });

//  Tag type cheatsheet
//  command : FF 00 00 00 03 D4 42 60
//  Vendor (04 = NXP)
//  |
//  D5 43 00 00 04   04    02        01   00      13    03 90 00
//       |      |         |   |       |
//  +------------+------+---------+-----------+--------------+
//  | Chip       | Type | Subtype | Version   | Storage size |
//  +------------+------+---------+-----------+--------------+
//  | NTAG210    | 0x04 | 0x01    | 0x01 0x00 | 0x0B         |
//  | NTAG212    | 0x04 | 0x01    | 0x01 0x00 | 0x0E         |
//  | NTAG213    | 0x04 | 0x02    | 0x01 0x00 | 0x0F         |
//  | NTAG213F   | 0x04 | 0x04    | 0x01 0x00 | 0x0F         |
//  | NTAG215    | 0x04 | 0x02    | 0x01 0x00 | 0x11         |
//  | NTAG216    | 0x04 | 0x02    | 0x01 0x00 | 0x13         |
//  | NTAG216F   | 0x04 | 0x04    | 0x01 0x00 | 0x13         |
//  +------------+------+---------+-----------+--------------+
//  | NT3H1101   | 0x04 | 0x02    | 0x01 0x01 | 0x13         |
//  | NT3H1101W0 | 0x04 | 0x05    | 0x02 0x01 | 0x13         |
//  | NT3H2111W0 | 0x04 | 0x05    | 0x02 0x02 | 0x13         |
//  | NT3H2101   | 0x04 | 0x02    | 0x01 0x01 | 0x15         |
//  | NT3H1201W0 | 0x04 | 0x05    | 0x02 0x01 | 0x15         |
//  | NT3H2211W0 | 0x04 | 0x05    | 0x02 0x02 | 0x15         |
//  +------------+------+---------+-----------+--------------+
//  | MF0UL1101  | 0x03 | 0x01    | 0x01 0x00 | 0x0B         |
//  | MF0ULH1101 | 0x03 | 0x02    | 0x01 0x00 | 0x0B         |
//  | MF0UL2101  | 0x03 | 0x01    | 0x01 0x00 | 0x0E         |
//  | MF0ULH2101 | 0x03 | 0x02    | 0x01 0x00 | 0x0E         |
//  +------------+------+---------+-----------+--------------+

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
    reader.transmit(Buffer.from([0xFF, 0x00, 0x00, 0x00, 0x03, 0xd4, 0x42, 0x60]), 13)
      .then((x) => {
        logger.debug('+--- Vendor    :', x[4]);
        logger.debug('+--- Type      :', x[5]);
        logger.debug('+--- SubType   :', x[6]);
        logger.debug('+--- Version 0 :', x[7]);
        logger.debug('+--- Version 1 :', x[8]);
        logger.debug('+--- Storage   :', x[9]);

        let cardModel = null;
        if (x[4] === 4 && x[5] === 4) {
          if (x[6] === 1 && x[7] === 1 && x[8] === 0 && x[9] === 11) {
            cardModel = 'NTAG210';
          } else if (x[6] === 1 && x[7] === 1 && x[8] === 0 && x[9] === 14) {
            cardModel = 'NTAG212';
          } else if (x[6] === 2 && x[7] === 1 && x[8] === 0 && x[9] === 15) {
            cardModel = 'NTAG213';
          } else if (x[6] === 4 && x[7] === 1 && x[8] === 0 && x[9] === 15) {
            cardModel = 'NTAG213F';
          } else if (x[6] === 2 && x[7] === 1 && x[8] === 0 && x[9] === 17) {
            cardModel = 'NTAG215';
          } else if (x[6] === 2 && x[7] === 1 && x[8] === 0 && x[9] === 19) {
            cardModel = 'NTAG216';
          } else if (x[6] === 4 && x[7] === 1 && x[8] === 0 && x[9] === 19) {
            cardModel = 'NTAG216F';
          }
        } else if (x[4] === 4 && x[5] === 3) {
          if (x[6] === 1 && x[7] === 1 && x[8] === 0 && x[9] === 0x0B) {
            cardModel = 'MF0UL1101';
          } else if (x[6] === 2 && x[7] === 1 && x[8] === 0 && x[9] === 0x0B) {
            cardModel = 'MF0ULH1101';
          } else if (x[6] === 1 && x[7] === 1 && x[8] === 0 && x[9] === 0x0E) {
            cardModel = 'MF0UL2101';
          } else if (x[6] === 2 && x[7] === 1 && x[8] === 0 && x[9] === 0x0E) {
            cardModel = 'MF0ULH2101';
          }
        } else if (x[4] === 0) {
          // TODO : FIX ? CHECK ?
          cardModel = 'MIFARE4K?';
        } else {
          cardModel = 'UNKNOWN';
        }
        Object.assign(card, { cardModel });
        if (nfcState.mode === 'erease') {
          ereaseWallet(reader);
        }
        io.emit('card', card);
        logger.debug(`${reader.reader.name}  card detected`, card);
      }).catch((x) => logger.error('err ', x));
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
    logger.debug('Erease mode');
    logger.info('Erease mode');
    nfcState.mode = 'erease';
  });
});
