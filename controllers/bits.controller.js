const bitsDb = require("../db/mysql/bits.db")

exports.matchBitHandler = async () => {
    try {
        const unMatchBitDbRes = await bitsDb.allUnMatch();
        if (unMatchBitDbRes.error) {
            return;
        }
        const matchBits = getMatchBits(unMatchBitDbRes.data)
        if(!matchBits){
            return;
        }


    } catch (error) {
        console.log(error) // todo in production log set
    }
}

function getMatchBits(bits) {
    let matchEventInfo = {eventIds:[],yes:[],no:[]};
    let yesMap = new Map();
    let isAnyMatch=false;
    for (let bitItem of bits) {
        if (bitItem.choose_option_id == 1) {
            yesMap.set(JSON.stringify([bitItem.event_id, bitItem.amount]), 1);
        }
    }

    for (let bitItem of bits) {
        if (bitItem.choose_option_id == 2) {
            let remaining = 10 - bitItem.amount;
            if (yesMap.get(JSON.stringify([bitItem.event_id, remaining]))) {
                isAnyMatch=true;
                if (!matchEventInfo[bitItem.event_id]) {
                    matchEventInfo[bitItem.event_id] = { yes: [], no: [] }
                }
                matchEventInfo[bitItem.event_id].yes.push(remaining);
                matchEventInfo[bitItem.event_id].no.push(bitItem.amount);
                yesMap.delete(JSON.stringify([bitItem.event_id, remaining]))
            }
        }
    }
    if(!isAnyMatch){
        return null
    }
    return matchEventInfo;

}

this.matchBitHandler()