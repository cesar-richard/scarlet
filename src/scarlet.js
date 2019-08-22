const { NFC } = require('nfc-pcsc');

const PORT = process.env.SOCKETPORT || 3001;
const io = require('socket.io')(PORT);
const logger = require('./logger');

const nfc = new NFC(logger);
logger.info('Listening on port ', PORT);

nfc.on('reader', (reader) => {
  logger.info(`${reader.reader.name}  device attached`);

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
    io.emit('detected', card);
    logger.info(`${reader.reader.name}  card detected`, card);
  });

  reader.on('card.off', (card) => {
    io.emit('off', card);
    logger.info(`${reader.reader.name}  card removed`, card);
  });

  reader.on('error', (err) => {
    io.emit('error', err);
    logger.info(`${reader.reader.name}  an error occurred`, err);
  });

  reader.on('end', () => {
    io.emit('detected', reader.reader.name);
    logger.info(`${reader.reader.name}  device removed`);
  });
});

nfc.on('error', (err) => {
  io.emit('nfcerror', err);
  logger.info('an error occurred', err);
});

io.on('connection', (client) => {
  logger.info('client connected');
  client.on('subscribeToNFC', () => {
    logger.info('client is subscribing to NFC events');
  });
});
