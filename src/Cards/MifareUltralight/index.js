const MifareUltralightPasswordAuthenticationError = require("./MifareUltralightPasswordAuthenticationError");
const MifareUltralightFastReadError = require("./MifareUltralightFastReadError");
const logger = require("../../logger");

const READER_ACR122 = {
  DIRECT_TRANSMIT: [0xff, 0x00, 0x00, 0x00],
  LC_DATA: [0x05],
  LC_VERSION: [0x03],
  DATA_PAYLOAD: [0xd4, 0x42, 0x3a, 0x04, 0x0f],
  VERSION_PAYLOAD: [0xd4, 0x42, 0x60],
  OFF_SET: 6,
  GET_DATA_PAYLOAD: [0xff, 0x00, 0x00, 0x00, 0x05, 0xd4, 0x42, 0x3a, 0x04, 0x0f]
};

module.exports = class MifareUltralight {
  constructor(reader) {
    this.reader = reader;
  }

  // PWD_AUTH
  async authenticate({ password, pack }) {
    // PASSWORD (4 bytes) (stored on card in page 18)
    // PACK (2 bytes) (stored in page 19 as first two bytes)
    // PACK is the response from card in case of successful PWD_AUTH cmd

    // CMD: PWD_AUTH via Direct Transmit (ACR122U) and Data Exchange (PN533)
    const cmd = Buffer.from([
      0xff, // Class
      0x00, // Direct Transmit (see ACR122U docs)
      0x00, // ...
      0x00, // ...
      0x07, // Length of Direct Transmit payload
      // Payload (7 bytes)
      0xd4, // Data Exchange Command (see PN533 docs)
      0x42, // InCommunicateThru
      0x1b, // PWD_AUTH
      ...password
    ]);

    const response = await this.reader.transmit(cmd, 7);
    // pwd_auth response should look like the following (7 bytes)
    // d5 43 00 ab cd 90 00
    // byte 0: d5 prefix for response of Data Exchange Command (see PN533 docs)
    // byte 1: 43 prefix for response of Data Exchange Command (see PN533 docs)
    // byte 2: Data Exchange Command Status 0x00 is success (see PN533 docs, Table 15. Error code list)
    // bytes 3-4: Data Exchange Command Response – our PACK (set on card in page 19, in bytes 0-1) from card
    // bytes 5-6: ACR122U success code

    if (response.length < 5) {
      throw new MifareUltralightPasswordAuthenticationError(
        "invalid_response_length",
        `Invalid response length ${response.length}. Expected minimal length was 2 bytes.`
      );
    }

    if (response[2] !== 0x00 || response.length < 7) {
      throw new MifareUltralightPasswordAuthenticationError(
        "invalid_password",
        "Authentication failed. Might be invalid password or unsupported card."
      );
    }

    if (!response.slice(3, 5).equals(pack)) {
      throw new MifareUltralightPasswordAuthenticationError(
        "pack_mismatch",
        "Pack mismatch."
      );
    }
    return true;
  }

  async reset(config) {
    return await this.reader.write(
      config.startPage,
      Buffer.allocUnsafe((1 + config.endPage - config.startPage) * 4).fill(0)
    );
  }
  async write(page, buffer) {
    for (let i = page; i < buffer.length / 4; i++) {
      // tag.writePage(i + 4, Arrays.copyOfRange(buffer, i * 4, (i + 1) * 4));
      this.reader.write(i + 4, buffer.slice(i * 4, (i + 1) * 4));
    }
    return await this.reader.write(page, buffer);
  }
  // FAST_READ
  async fastRead(startPage, endPage) {
    // CMD: PWD_AUTH via Direct Transmit (ACR122U) and Data Exchange (PN533)
    const cmd = Buffer.from([
      0xff, // Class
      0x00, // Direct Transmit (see ACR122U docs)
      0x00, // ...
      0x00, // ...
      0x07, // Length of Direct Transmit payload
      // Payload (7 bytes)
      0xd4, // Data Exchange Command (see PN533 docs)
      0x42, // InCommunicateThru
      0x3a, // PWD_AUTH
      startPage,
      endPage
    ]);

    const length = 3 + (endPage - startPage + 1) * 4 + 2;

    const response = await this.reader.transmit(cmd, length);

    if (response < length) {
      throw new MifareUltralightFastReadError(
        "invalid_response_length",
        `Invalid response length ${response.length}. Expected length was ${length} bytes.`
      );
    }

    return response.slice(3, -2);
  }
};
