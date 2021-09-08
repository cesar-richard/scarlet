const { NFC } = require("nfc-pcsc");

const PORT = process.env.SOCKETPORT || 3001;
const io = require("socket.io")(PORT);
const Sentry = require("@sentry/node");
const MifareUltralight = require("./Cards/MifareUltralight");
const MifareClassic4K = require("./Cards/MifareClassic4K");
const Helpers = require("./Cards/helpers");
const logger = require("./logger");

Sentry.init({
  dsn: "https://84064b30c0fe49abb7feb8baea032ca9@sentry.io/1793383"
});

const helpers = new Helpers();
const nfc = new NFC(logger);
const nfcState = {
  reader: null,
  connected: false,
  mode: "erease"
};
let cardHandler = null;
const gillConfig = {};

nfc.on("reader", reader => {
  logger.info(`${reader.reader.name}  device attached`);
  nfcState.connected = true;
  nfcState.reader = reader.reader;
  io.emit("start", reader.reader.name);
  const ultralight = new MifareUltralight(reader);
  const classic4K = new MifareClassic4K(reader);

  reader.on("card", card => {
    let authConfig = {};
    Helpers.getCardModel(reader)
      .then(model => {
        Object.assign(card, { model });
        switch (model.type) {
          case "ULTRALIGHT":
            cardHandler = ultralight;
            if (!gillConfig.offline_ev1password)
              throw new "Not yet got gill config"();
            authConfig = {
              startPage: 0x04,
              endPage: 0x0f
            };
            Object.assign(
              authConfig,
              Helpers.computeEV1PassAndPack(
                card.uid,
                gillConfig.offline_ev1password
              )
            );
            break;
          case "MIFARE":
            cardHandler = classic4K;
            authConfig = {
              block: 28,
              keyA: "A0A1A2A3A4A5",
              keyB: "D7D8D9DADBDC"
            };
            break;
          default:
            throw new "UNKNOWN card type"();
        }
        if (nfcState.mode === "erease") {
          //nfcState.mode = "reader";
          cardHandler
            .authenticate(authConfig)
            .then(() => {
              cardHandler
                .reset(authConfig)
                .then(data => {
                  cardHandler
                    .fastRead(authConfig.startPage, authConfig.endPage)
                    .then(data => logger.info("reset succeed ", data))
                    .catch(warn => logger.error("reset failed ", warn));
                })
                .catch(e => logger.error);
            })
            .catch(e => logger.error);
        }
        io.emit("card", card);
      })
      .catch(error => logger.error("GET OLD : ", error));
  });

  reader.on("card.off", card => {
    io.emit("off", card);
    logger.info(`${reader.reader.name}  card removed`, card);
  });

  reader.on("error", err => {
    io.emit("error", err.toString());
    logger.error(
      `READER ${reader.reader.name} an error occurred`,
      err.toString()
    );
  });

  reader.on("end", () => {
    nfcState.connected = false;
    nfcState.reader = null;
    io.emit("end");
    logger.info(`${reader.reader.name}  device removed`);
  });
});

nfc.on("nfcerror", err => {
  io.emit("error", err.toString());
  logger.error("an error occurred", err.toString());
});

io.on("connection", client => {
  io.emit("getGillConfig");
  logger.info("client connected");
  if (nfcState.connected) {
    io.emit("start", nfcState.reader.name);
  } else {
    io.emit("end");
  }
  client.on("subscribeToNFC", () => {
    logger.info("client is subscribing to NFC events");
  });
  client.on("ereaseWallet", () => {
    logger.debug("Erease mode");
    logger.info("Erease mode");
    nfcState.mode = "erease";
  });
  client.on("systemConfig", config => {
    logger.debug("Got gill system config");
    Object.assign(gillConfig, config);
  });
});
