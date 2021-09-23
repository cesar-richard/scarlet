const crypto = require("crypto");
const READER_ACR122 = {
  GET_DATAS: [0xff, 0xca, 0x00, 0x00, 0x00],
  GET_MODEL__: [0xff, 0x00, 0x00, 0x00, 0x03, 0xd4, 0x42, 0x60]
};
module.exports = class Helper {
  static computeEV1PassAndPack(cardUid, gillEV1Password) {
    const hmacSignature = Buffer.from(
      crypto
        .createHmac("SHA1", gillEV1Password.toUpperCase())
        .update(cardUid.toUpperCase())
        .digest("hex"),
      "hex"
    );
    return {
      password: hmacSignature.slice(0, 4),
      pack: hmacSignature.slice(4, 6)
    };
  }

  static async getCardModel({ reader, card }) {
    let cardModel = {};
    const x = await reader.transmit(Buffer.from(READER_ACR122.GET_MODEL__), 13);
    const data = await reader.transmit(
      Buffer.from(READER_ACR122.GET_DATAS),
      40
    );
    if (data.slice(-1)[0] !== 0x00) {
      throw "Error getting card UID";
    }
    Object.assign(card, { uid: data.slice(0, -2).toString("hex") });
    if (x[4] === 4 && x[5] === 4) {
      cardModel.type = "NTAG";
      if (x[6] === 1 && x[7] === 1 && x[8] === 0 && x[9] === 11) {
        cardModel.name = "NTAG210";
      } else if (x[6] === 1 && x[7] === 1 && x[8] === 0 && x[9] === 14) {
        cardModel.name = "NTAG212";
      } else if (x[6] === 2 && x[7] === 1 && x[8] === 0 && x[9] === 15) {
        cardModel.name = "NTAG213";
      } else if (x[6] === 4 && x[7] === 1 && x[8] === 0 && x[9] === 15) {
        cardModel.name = "NTAG213F";
      } else if (x[6] === 2 && x[7] === 1 && x[8] === 0 && x[9] === 17) {
        cardModel.name = "NTAG215";
      } else if (x[6] === 2 && x[7] === 1 && x[8] === 0 && x[9] === 19) {
        cardModel.name = "NTAG216";
      } else if (x[6] === 4 && x[7] === 1 && x[8] === 0 && x[9] === 19) {
        cardModel.name = "NTAG216F";
      }
    } else if (x[4] === 4 && x[5] === 3) {
      cardModel.type = "ULTRALIGHT";
      if (x[6] === 1 && x[7] === 1 && x[8] === 0 && x[9] === 0x0b) {
        cardModel.name = "MF0UL1101";
      } else if (x[6] === 2 && x[7] === 1 && x[8] === 0 && x[9] === 0x0b) {
        cardModel.name = "MF0ULH1101";
      } else if (x[6] === 1 && x[7] === 1 && x[8] === 0 && x[9] === 0x0e) {
        cardModel.name = "MF0UL2101";
      } else if (x[6] === 2 && x[7] === 1 && x[8] === 0 && x[9] === 0x0e) {
        cardModel.name = "MF0ULH2101";
      }
    } else if (x[4] === 0) {
      // TODO : FIX ? CHECK ?
      cardModel.type = "MIFARE";
      cardModel.name = "MIFARE4K?";
      if (card.type === "TAG_ISO_14443_4") {
        cardModel.type = "MIFARE_DESFIRE";
        cardModel.name = "DESFIRE_EV2";
        delete card.data;
      }
    } else {
      cardModel.type = "UNKNOWN";
      cardModel.name = "UNKNOWN";
    }
    Object.assign(card, { model: cardModel });
    delete card.atr;
    return card;
  }
};
