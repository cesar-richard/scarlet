const { TransmitError } = require("nfc-pcsc");

module.exports = class MifareUltralightFastReadError extends TransmitError {
  constructor(code, message, previousError) {
    super(code, message, previousError);
    this.name = "MifareUltralightFastReadError";
  }
};
