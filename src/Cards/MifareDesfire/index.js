exports.getDatas = async reader => {
  const data = await reader.transmit(
    Buffer.from([0xff, 0xca, 0x00, 0x00, 0x00]),
    40
  );

  if (data.slice(-1)[0] !== 0x00) {
    throw "Error in MifafareDesfire::getDatas";
  }
  return data.slice(0, -2);
};

exports.getModel = async reader => {
  const data = await reader.transmit(
    Buffer.from([0x00, 0xb0, 0x00, 0x00, 0x20]),
    40
  );
  return data;
};
