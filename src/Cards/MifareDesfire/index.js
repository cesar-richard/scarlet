const logger = require("../../logger");

const READER_ACR122 = {
  GET_DATAS: [0xff, 0xca, 0x00, 0x00, 0x00],
  GET_MODEL: [0x00, 0xb0, 0x00, 0x00, 0x20]
};

module.exports = class MifareDesfire {
  constructor(reader) {
    this.reader = reader;
  }
  async authenticate({ password, pack }) {}
  async reset(config) {}
  async write(page, buffer) {}
  async fastRead(startPage, endPage) {}
  async getDatas() {
    const data = await this.reader.transmit(
      Buffer.from(READER_ACR122.GET_DATAS),
      40
    );

    if (data.slice(-1)[0] !== 0x00) {
      throw "Error in MifafareDesfire::getDatas";
    }
    return data.slice(0, -2);
  }
  async getModel() {
    return await this.reader.transmit(Buffer.from(READER_ACR122.GET_MODEL), 40);
  }
};
