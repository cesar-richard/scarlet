const {NFC} = require("nfc-pcsc");
const logger = require("./logger");
const axios = require("axios");
const Helpers = require("./helpers");
const nfc = new NFC();
const nfcState = {
    reader: null,
    connected: false,
    sessionId: null
};

const login = () => {
    return axios.post("https://api.nemopay.net/services/MYACCOUNT/login2?system_id=80405&app_key=0a93e8e18e6ed78fa50c4d74e949801b", {
        login: "licorne@utc.fr", password: "r9222yda"
    })
}

const findWallet = (cardUid) => {
    return axios.post("https://api.nemopay.net/services/GESUSERS/walletAutocomplete?system_id=80405&app_key=0a93e8e18e6ed78fa50c4d74e949801b&sessionid=" + nfcState.sessionId, {
        queryString: cardUid, wallet_config: 1, lookup_only: "tag"
    })
}

const createPairing = (walletId) => {
    return axios.post("https://api.nemopay.net/services/GESUSERS/createPairing?system_id=80405&app_key=0a93e8e18e6ed78fa50c4d74e949801b&sessionid=" + nfcState.sessionId, {
        wallet: walletId, uid: null, short_tag: null
    })
}

nfc.on("reader", reader => {
    reader.aid = "F222222222";
    logger.info(`${reader.reader.name}  device attached`);
    nfcState.connected = true;
    nfcState.reader = reader.reader;

    reader.on("card", async card => {
        Helpers.getCardModel({reader, card})
            .then(model => {
                Object.assign(card, {model});
                logger.debug("CARD : ", card)
                login().then(retlogin => {
                    logger.info("retLogin", retlogin.data)
                    nfcState.sessionId = retlogin.data.sessionid;
                    findWallet(card.uid).then(wallet => {
                        logger.info("wallet", wallet.data[0])
                        createPairing(wallet.data[0].id).then(pairing => logger.info("pairing", pairing.data)).catch(e => logger.error("pairing", e.response.data.error));
                    }).catch(e => logger.error("wallet", e.response.data));
                }).catch(e => logger.error("login", e.response.data));
            }).catch(e=>logger.error("getCardModel", e))
    })

    reader.on("card.off", card => {
        logger.info(`${reader.reader.name}  card removed`, card);
    });

    reader.on("error", err => {
        logger.error(
            `READER ${reader.reader.name} an error occurred`,
            err.toString()
        );
    });

    reader.on("end", () => {
        nfcState.connected = false;
        nfcState.reader = null;
        logger.info(`${reader.reader.name}  device removed`);
    });
});

nfc.on("nfcerror", err => {
    io.emit("error", err.toString());
    logger.error("an error occurred", err.toString());
});

