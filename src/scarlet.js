const fs = require('fs');
const {NFC, CONNECT_MODE_DIRECT} = require("nfc-pcsc");
const logger = require("./logger");
const axios = require("axios");
const Helpers = require("./helpers");
const nfc = new NFC();
const nfcState = {
    reader: null,
    connected: false,
    sessionId: null
};

// For todays date;
Date.prototype.today = function () { 
    return ((this.getDate() < 10)?"0":"") + this.getDate() +"/"+(((this.getMonth()+1) < 10)?"0":"") + (this.getMonth()+1) +"/"+ this.getFullYear();
}

// For the time now
Date.prototype.timeNow = function () {
     return ((this.getHours() < 10)?"0":"") + this.getHours() +":"+ ((this.getMinutes() < 10)?"0":"") + this.getMinutes() +":"+ ((this.getSeconds() < 10)?"0":"") + this.getSeconds();
}

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

const processCard = (reader, card) => {
    return findWallet(card.uid).then(wallet => {
        logger.info("wallet", wallet.data[0])
        return createPairing(wallet.data[0].id)
            .then(pairing => {
                logger.debug("pairing", pairing.data)
		const newDate = new Date();
		console.log(wallet.data[0]);
		fs.writeFileSync('/tmp/logs.log', JSON.stringify({when: newDate.today() + " " + newDate.timeNow(), card: card.uid, wallet: wallet.data[0].id, username: wallet.data[0].username, name: wallet.data[0].name, email: wallet.data[0].email}) + ",\n",{ flag: 'a+' });
            })
            .catch(async e => {
                logger.error("pairing", e.response.data.error)
                throw e
            });
    }).catch(e => {
        logger.error("wallet", e.response.data)
        throw e
    });
}

const ledError = async (reader) => {
    await reader.led(0b01011101, [0x01, 0x01, 0x03, 0x02]);
}

const ledSuccess = async (reader) => {
    await reader.led(0b00101110, [0x02, 0x07, 0x01, 0x07]);
}

nfc.on("reader", async reader => {
    reader.aid = "F222222222";
    logger.info(`${reader.reader.name}  device attached`);
    nfcState.connected = true;
    nfcState.reader = reader.reader;

    try {
        await reader.connect(CONNECT_MODE_DIRECT);
        await reader.setBuzzerOutput(false);
        await reader.disconnect();
    } catch (err) {
        console.info(`initial sequence error`, reader, err);
    }

    reader.on("card", async card => {
        Helpers.getCardModel({reader, card})
            .then(model => {
                Object.assign(card, {model});
                logger.debug("CARD : ", card)
                processCard(reader, card)
                    .then(async (e) => {
                        await ledError(reader)
                        console.log("Pairing succeed", e)
                    })
                    .catch(err => {
                        if (err.response.data.error.code === '403') {
                            console.log("Logged in")
                            login().then(retlogin => {
                                logger.debug("retLogin", retlogin.data)
                                nfcState.sessionId = retlogin.data.sessionid;
                                processCard(reader, card)
                                    .then(async () => {
                                        await ledSuccess(reader)
                                        console.log("Pairing finally succeed")
                                    })
                                    .catch(async err => {
                                        await ledError(reader)
                                        console.error("process", err)
                                    })
                            }).catch(async e => {
                                await ledError(reader)
                                logger.error("login", e.response.data)
                            });
                        }
                    })
            }).catch(async e => {
            logger.error("getCardModel", e)
            await ledError(reader)
        })
    })

    reader.on("card.off", async card => {
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

