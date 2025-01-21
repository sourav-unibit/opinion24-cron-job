const bitsDb = require("../db/mysql/bits.db")
const dbConstant = require("../utils/dbConstant.utils")
const constUtils = require("../utils/constant.utils");
const tradesModel = require("../models/trades.model");

exports.matchBitsHandler = async () => {
    try {
        const startTime=new Date()
        const unMatchBitDbRes = await bitsDb.allUnMatch();
        if (unMatchBitDbRes.error) {
            return;
        }
        const matchBits = getMatchBits(unMatchBitDbRes.data);
        console.log((new Date()-startTime)/1000);
        return;
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
            mapOperationOfGetMatchBits(bitItem, noMap, yesMap, matchEventInfo, isAnyMatch, "yes", "no");
        }
        else if (bitItem.choose_option_id == dbConstant.mysql.bits.choose_option_id.no) {
            mapOperationOfGetMatchBits(bitItem, yesMap, noMap, matchEventInfo, isAnyMatch, "no", "yes")
        }
    }
    if (!isAnyMatch.match) {
        return null
    }
    return matchEventInfo;

}

function mapOperationOfGetMatchBits(bitItem, getMap, setMap, matchEventInfo, isAnyMatch, action1, action2) {
    let getMapKey = JSON.stringify([bitItem.event_id, 10 - bitItem.amount])
    let isExitBitAmount = getMap.get(getMapKey)
    if (isExitBitAmount) {
        isAnyMatch.match = true;
        if (!matchEventInfo[bitItem.event_id]) {
            matchEventInfo[bitItem.event_id] = { yes: [], no: [] }
        }
        let minCount = Math.min(isExitBitAmount.totalCount, bitItem.total_count);
        matchEventInfo[bitItem.event_id][action1].push({ amount: bitItem.amount, limit: minCount, chooseOptionId: bitItem.choose_option_id });
        matchEventInfo[bitItem.event_id][action2].push({ amount: isExitBitAmount.amount, limit: minCount, chooseOptionId: isExitBitAmount.chooseOptionId });
        getMap.delete(getMapKey);
    } else {
        setMap.set(JSON.stringify([bitItem.event_id, bitItem.amount]), { totalCount: bitItem.total_count, amount: bitItem.amount, chooseOptionId: bitItem.choose_option_id });
    }

}

async function updateMatchBit(eventId, yesArr, noArr) {
    let bitsPromise = [];
    let yesAmounts = [];
    let noAmounts = [];
    let limitMap = new Map();

    for (let yesItem of yesArr) {
        yesAmounts.push(yesItem.amount);
        limitMap.set(yesItem.amount, yesItem.limit);
    }
    for (let noItem of noArr) {
        noAmounts.push(noItem.amount);
        limitMap.set(noItem.amount, noItem.limit);
    }
    if (yesAmounts.length < noAmounts.length) {
        bitsPromise.push(bitsDb.allMatches(eventId, dbConstant.mysql.bits.choose_option_id.yes, yesAmounts))
        bitsPromise.push(bitsDb.allMatches(eventId, dbConstant.mysql.bits.choose_option_id.no, noAmounts))
    } else {
        bitsPromise.push(bitsDb.allMatches(eventId, dbConstant.mysql.bits.choose_option_id.no, noAmounts))
        bitsPromise.push(bitsDb.allMatches(eventId, dbConstant.mysql.bits.choose_option_id.yes, yesAmounts))
    }

    const bitsPromiseRes = await Promise.all(bitsPromise);
    let yesMap = new Map();
    let noMap = new Map();
    let newTrades = [];
    let matchBitIds = [];
    for (let bitItemArr of bitsPromiseRes) {
        if(bitItemArr.error){
            continue;
        }
        for (let bitItem of bitItemArr.data) {
            if (bitItem.error) {
                continue
            }
            if (bitItem.choose_option_id == 1) {
                mapOperationOfUpdateMatchBit(bitItem, noMap, yesMap, matchBitIds, newTrades, limitMap)
            }
            else if (bitItem.choose_option_id == 2) {
                mapOperationOfUpdateMatchBit(bitItem, yesMap, noMap, matchBitIds, newTrades, limitMap)
            }
        }
    }

    if (matchBitIds.length === 0 || newTrades.length == 0) {
        return;
    }

    console.log(matchBitIds)

    // bitsDb.updateMatchIdsStatus(matchBitIds)
    // createTreads(newTrades);
}

function mapOperationOfUpdateMatchBit(bitItem, getMap, setMap, matchBitIds, newTrades, limitMap) {
    let currentLimitKey = bitItem.amount;
    let matchLimitKey = 10 - bitItem.amount;
    let currentLimitValue = limitMap.get(currentLimitKey)
    let matchLimitValue = limitMap.get(matchLimitKey)
    if (currentLimitValue == 0 || matchLimitValue == 0) {
        return;
    }
    let getMapKey = 10 - bitItem.amount;
    let isBitExist = getMap.get(getMapKey);
    let existBitIndex = isBitExist ? isBitExist.findIndex((item) => item.user_id != bitItem.user_id) : -1
    if (existBitIndex != -1) {

        const existBitData = isBitExist.splice(existBitIndex, 1)[0];
        matchBitIds.push(existBitData.id);
        matchBitIds.push(bitItem.id);
        storeNewTrade(newTrades, bitItem.event_id, bitItem, existBitData);
        getMap.set(getMapKey, isBitExist)

        if (currentLimitValue) {
            limitMap.set(currentLimitKey, currentLimitValue - 1)
        }
        if (matchLimitValue) {
            limitMap.set(matchLimitKey, matchLimitValue - 1)
        }

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

function storeNewTrade(newTrades, eventId, yesObj, noObj) {
    const yesFilterObj = {
        bitId: yesObj.id,
        userId: yesObj.user_id,
        userName: yesObj.user_name,
        userPic: yesObj.user_pic,
        amount: yesObj.amount,
        chooseOptionId: yesObj.choose_option_id,
        createdDate: yesObj.created_date,
    }
    const noFilterObj = {
        bitId: noObj.id,
        userId: noObj.user_id,
        userName: noObj.user_name,
        userPic: noObj.user_pic,
        amount: noObj.amount,
        chooseOptionId: noObj.choose_option_id,
        createdDate: noObj.created_date,
    }
    const newTread = {
        eventId: eventId,
        bits: [yesFilterObj, noFilterObj]
    }
    newTrades.push(newTread)
}

function createTreads(newTrades) {
    tradesModel.insertMany(newTrades)

}

this.matchBitsHandler()