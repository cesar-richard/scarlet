const { KEY_TYPE_A, KEY_TYPE_B } = require("nfc-pcsc");
const logger = require("../../logger");

module.exports = class MifareClassic4K {
  constructor(reader) {
    this.reader = reader;
    this.name = "MifareClassic4K";
  }

  authenticate({ block, keyA, keyB }) {
    logger.info(JSON.stringify({ block, keyA, keyB }));
    this.reader
      .authenticate(block, KEY_TYPE_A, keyA)
      .then(data => {
        logger.info(`Auth A OK  ${data}`);
        this.reader
          .authenticate(block, KEY_TYPE_B, keyB)
          .then(data2 => {})
          .catch(logger.error);
      })
      .catch(err => logger.error(`AUTH A ERR ${err}`));
  }

  reset(block) {
    logger.error("ELLE SUCE DES BAMBOUS");
    const binary = Buffer.allocUnsafe(16);
    binary.fill(0);
    this.reader
      .write(block, binary, binary.length)
      .then(dataB => {
        logger.info(`Write ${dataB}`);
        this.reader
          .read(block, 16)
          .then(dataAB => logger.info(`Post write read ${dataAB}`))
          .catch(err3 => logger.error(`yo read ${err3}`));
      })
      .catch(err2 => logger.error(`Error writing wallet ${err2}`));
  }
};
