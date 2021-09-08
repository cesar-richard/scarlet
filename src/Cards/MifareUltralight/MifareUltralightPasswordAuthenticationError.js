const { TransmitError } = require("nfc-pcsc");

module.exports = class MifareUltralightPasswordAuthenticationError extends TransmitError {
  constructor(code, message, previousError) {
    super(code, message, previousError);
    this.name = "MifareUltralightPasswordAuthenticationError";
  }
};
