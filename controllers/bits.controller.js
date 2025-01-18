const bitsDb = require("../db/mysql/bits.db")
const dbConstant=require("../utils/dbConstant.utils")
const constUtils=require("../utils/constant.utils")

exports.matchBitsHandler = async () => {
    try {
        const unMatchBitDbRes = await bitsDb.allUnMatch();
        if (unMatchBitDbRes.error) {
            return;
        }
        const matchBits = getMatchBits(unMatchBitDbRes.data)

        if (!matchBits) {
            return;
        }
        for (let key in matchBits) {
            if (matchBits[key].yes.length != matchBits[key].no.length) {
                continue;
            }
            updateMatchBit(key, matchBits[key].yes, matchBits[key].no)
        }


    } catch (error) {
        console.log(error) // todo in production log set
    }
}

function getMatchBits(bits) {
    let matchEventInfo = {};
    let yesMap = new Map();
    let isAnyMatch = false;
    for (let bitItem of bits) {
        if (bitItem.choose_option_id == dbConstant.mysql.bits.choose_option_id.yes) {
            yesMap.set(JSON.stringify([bitItem.event_id, bitItem.amount]), bitItem.total_count);
        }
    }

    for (let bitItem of bits) {
        if (bitItem.choose_option_id == dbConstant.mysql.bits.choose_option_id.no) {
            let remaining = constUtils.key.eventTotalPoint - bitItem.amount;
            if (yesMap.get(JSON.stringify([bitItem.event_id, remaining]))) {
                isAnyMatch = true;
                if (!matchEventInfo[bitItem.event_id]) {
                    matchEventInfo[bitItem.event_id] = { yes: [], no: [] }
                }
                let yesCount = yesMap.get(JSON.stringify([bitItem.event_id, remaining]));
                let minCount = Math.min(yesCount, bitItem.total_count);
                matchEventInfo[bitItem.event_id].yes.push({ amount: remaining, limit: minCount });
                matchEventInfo[bitItem.event_id].no.push({ amount: bitItem.amount, limit: minCount });
                yesMap.delete(JSON.stringify([bitItem.event_id, remaining]));
            }
        }
    }
    if (!isAnyMatch) {
        return null
    }
    return matchEventInfo;

}

async function updateMatchBit(eventId, yesArr, noArr) {
    let bitsPromise=[];
    for(let yesItem of yesArr){
        bitsPromise.push(bitsDb.allMatch(eventId,dbConstant.mysql.bits.choose_option_id.yes,yesItem.amount,yesItem.limit))
    }
    for(let noItem of noArr){
        bitsPromise.push(bitsDb.allMatch(eventId,dbConstant.mysql.bits.choose_option_id.no,noItem.amount,noItem.limit))
    }
    const bitsPromiseRes=await Promise.all(bitsPromise);
    console.log(bitsPromiseRes[0])
}

this.matchBitsHandler()