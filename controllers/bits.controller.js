const bitsDb = require("../db/mysql/bits.db")
const dbConstant = require("../utils/dbConstant.utils")
const constUtils = require("../utils/constant.utils")

exports.matchBitsHandler = async () => {
    try {
        const unMatchBitDbRes = await bitsDb.allUnMatch();
        if (unMatchBitDbRes.error) {
            return;
        }
        const matchBits = getMatchBits(unMatchBitDbRes.data);
        console.log(matchBits)
        if (!matchBits) {
            return;
        }
        for (let key in matchBits) {
            console.log(key,matchBits[key].yes.sort((a,b)=>a.amount-b.amount) != matchBits[key].no.sort((a,b)=>a.amount-b.amount))
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
    let noMap = new Map();
    let isAnyMatch = false;
    for (let bitItem of bits) {
        if (bitItem.choose_option_id == dbConstant.mysql.bits.choose_option_id.yes) {
            mapOperationOfGetMatchBits(bitItem, noMap, yesMap, matchEventInfo);
        }
        else if (bitItem.choose_option_id == dbConstant.mysql.bits.choose_option_id.no) {
            mapOperationOfGetMatchBits(bitItem, yesMap, noMap, matchEventInfo)
        }
    }
    console.log(matchEventInfo)
    //todo check how isAnyMatch variable asign in fun
    if (!isAnyMatch) {
        return null
    }
    return matchEventInfo;

}

function mapOperationOfGetMatchBits(bitItem, getMap, setMap, matchEventInfo) {
    let getMapKey = JSON.stringify([bitItem.event_id, 10 - bitItem.amount])
    let isExitBitAmount = getMap.get(getMapKey)
    if (isExitBitAmount) {
        if (!matchEventInfo[bitItem.event_id]) {
            matchEventInfo[bitItem.event_id] = { yes: [], no: [] }
        }
        let minCount = Math.min(isExitBitAmount.totalCount, bitItem.total_count);
        matchEventInfo[bitItem.event_id].yes.push({ amount: bitItem.amount, limit: minCount });
        matchEventInfo[bitItem.event_id].no.push({ amount: isExitBitAmount.amount, limit: minCount });
        getMap.delete(getMapKey);
    } else {
        setMap.set(JSON.stringify([bitItem.event_id, bitItem.amount]), { totalCount: bitItem.total_count, amount: bitItem.amount });
    }
    
}

async function updateMatchBit(eventId, yesArr, noArr) {
    let bitsPromise = [];
    for (let yesItem of yesArr) {
        bitsPromise.push(bitsDb.allMatch(eventId, dbConstant.mysql.bits.choose_option_id.yes, yesItem.amount, yesItem.limit))
    }
    for (let noItem of noArr) {
        bitsPromise.push(bitsDb.allMatch(eventId, dbConstant.mysql.bits.choose_option_id.no, noItem.amount, noItem.limit))
    }
    const bitsPromiseRes = await Promise.all(bitsPromise);
    console.log(bitsPromiseRes[0])
}

this.matchBitsHandler()