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
        if (!matchBits) {
            return;
        }
        for (let key in matchBits) { //key means eventId
            // console.log(key,matchBits[key].yes.sort((a,b)=>a.amount-b.amount) , matchBits[key].no.sort((a,b)=>b.amount-a.amount))
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
    let isAnyMatch = { match: false };
    for (let bitItem of bits) {
        if (bitItem.choose_option_id == dbConstant.mysql.bits.choose_option_id.yes) {
            mapOperationOfGetMatchBits(bitItem, noMap, yesMap, matchEventInfo, isAnyMatch);
        }
        else if (bitItem.choose_option_id == dbConstant.mysql.bits.choose_option_id.no) {
            mapOperationOfGetMatchBits(bitItem, yesMap, noMap, matchEventInfo, isAnyMatch)
        }
    }
    if (!isAnyMatch) {
        return null
    }
    return matchEventInfo;

}

function mapOperationOfGetMatchBits(bitItem, getMap, setMap, matchEventInfo, isAnyMatch) {
    let getMapKey = JSON.stringify([bitItem.event_id, 10 - bitItem.amount])
    let isExitBitAmount = getMap.get(getMapKey)
    if (isExitBitAmount) {
        isAnyMatch.match = true;
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

    let yesMap = new Map();
    let noMap = new Map();
    let newTreads = [];
    let matchBitIds = [];
    for (let bitItemArr of bitsPromiseRes) {
        for (let bitItem of bitItemArr.data) {
            if (bitItem.choose_option_id == 1) {
                mapOperationOfUpdateMatchBit(bitItem, noMap, yesMap, matchBitIds, newTreads)
            }
            else if (bitItem.choose_option_id == 2) {
                mapOperationOfUpdateMatchBit(bitItem, yesMap, noMap, matchBitIds, newTreads)
            }
        }
    }
    if(matchBitIds.length===0||newTreads.length==0){
        return;
    }
    // bitsDb.updateMatchIdsStatus(matchBitIds)
    
    //Todo create treads model
}

function mapOperationOfUpdateMatchBit(bitItem, getMap, setMap, matchBitIds, newTreads) {
    let getMapKey = 10 - bitItem.amount;
    let isBitExist = getMap.get(getMapKey);
    let existBitIndex = isBitExist ? isBitExist.findIndex((item) => item.user_id != bitItem.user_id) : -1
    if (existBitIndex != -1) {
        const existBitData = isBitExist.splice(existBitIndex, 1)[0];
        matchBitIds.push(existBitData.id);
        matchBitIds.push(bitItem.id);
        storeNewTreads(newTreads, bitItem.event_id, bitItem, existBitData);
        getMap.set(getMapKey, isBitExist)
    } else {
        const setMapKey = bitItem.amount;
        let setData = [];
        const isSetMapExist = setMap.get(setMapKey);
        if (isSetMapExist) {
            setData = isSetMapExist
        }
        setData.push(bitItem)
        setMap.set(bitItem.amount, setData)
    }
}

function storeNewTreads(newTreads, eventId, yesObj, noObj) {
    const newTread = {
        eventId: eventId,
        bits: [yesObj, noObj]
    }
    newTreads.push(newTread)
}

this.matchBitsHandler()