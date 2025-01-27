const bidsDb = require("../db/mysql/bids.db")
const dbConstant = require("../utils/dbConstant.utils")
const constUtils = require("../utils/constant.utils");
const tradesModel = require("../models/trades.model");
const dateFormatModule = require("../modules/dateFormat.module")

exports.matchBidsHandler = async () => {
    try {
        console.log("group query start: ", dateFormatModule.getByFormat())
        const unMatchBitDbRes = await bidsDb.allUnMatch();
        if (unMatchBitDbRes.error) {
            return;
        }
        console.log("group query end: ", dateFormatModule.getByFormat())
        const matchBids = getMatchBids(unMatchBitDbRes.data);
        console.log("matching bits end: ", dateFormatModule.getByFormat())
        if (!matchBids) {
            return;
        }
        for (let key in matchBids) { //key means eventId
            // console.log(key,matchBids[key].yes.sort((a,b)=>a.amount-b.amount) , matchBids[key].no.sort((a,b)=>b.amount-a.amount))
            if (matchBids[key].yes.length != matchBids[key].no.length) {
                continue;
            }
            updateMatchBit(key, matchBids[key].yes, matchBids[key].no)
        }

    } catch (error) {
        console.log(error) // todo in production log set
    }
}

function getMatchBids(bids) {
    let matchEventInfo = {};
    let yesMap = new Map();
    let noMap = new Map();
    let isAnyMatch = { match: false };
    for (let bitItem of bids) {
        if (bitItem.choose_option_id == dbConstant.mysql.bids.choose_option_id.yes) {
            mapOperationOfGetMatchBids(bitItem, noMap, yesMap, matchEventInfo, isAnyMatch, "yes", "no");
        }
        else if (bitItem.choose_option_id == dbConstant.mysql.bids.choose_option_id.no) {
            mapOperationOfGetMatchBids(bitItem, yesMap, noMap, matchEventInfo, isAnyMatch, "no", "yes")
        }
    }
    if (!isAnyMatch.match) {
        return null
    }
    return matchEventInfo;

}

function mapOperationOfGetMatchBids(bitItem, getMap, setMap, matchEventInfo, isAnyMatch, action1, action2) {
    let getMapKey = JSON.stringify([bitItem.event_id, 10 - bitItem.amount])
    let isExitBitAmount = getMap.get(getMapKey)
    if (isExitBitAmount) {
        isAnyMatch.match = true;
        if (!matchEventInfo[bitItem.event_id]) {
            matchEventInfo[bitItem.event_id] = { yes: [], no: [] }
        }
        let action1Limit = 0;
        let action2Limit = 0;
        if (isExitBitAmount.totalCount < bitItem.total_count) {
            action1Limit = isExitBitAmount.totalCount + 20;
            action2Limit = isExitBitAmount.totalCount;
        } else {
            action1Limit = bitItem.total_count
            action2Limit = bitItem.total_count + 20;
        }
        matchEventInfo[bitItem.event_id][action1].push({ amount: bitItem.amount, limit: action1Limit, chooseOptionId: bitItem.choose_option_id });
        matchEventInfo[bitItem.event_id][action2].push({ amount: isExitBitAmount.amount, limit: action2Limit, chooseOptionId: isExitBitAmount.chooseOptionId });
        getMap.delete(getMapKey);
    } else {
        setMap.set(JSON.stringify([bitItem.event_id, bitItem.amount]), { totalCount: bitItem.total_count, amount: bitItem.amount, chooseOptionId: bitItem.choose_option_id });
    }

}

async function updateMatchBit(eventId, yesArr, noArr) {
    console.log(`updateMatchBit enter: ${eventId}`, dateFormatModule.getByFormat())
    let yesPromise = [];
    let noPromise = [];

    for (let yesItem of yesArr) {
        yesPromise.push(bidsDb.allMatch(eventId, dbConstant.mysql.bids.choose_option_id.yes, yesItem.amount, yesItem.limit));
    }
    for (let noItem of noArr) {
        noPromise.push(bidsDb.allMatch(eventId, dbConstant.mysql.bids.choose_option_id.no, noItem.amount, noItem.limit));
    }
    console.log(`bids get enter: ${eventId}`, dateFormatModule.getByFormat())
    const bidsPromiseRes = await Promise.all([Promise.all(yesPromise), Promise.all(noPromise)]);
    console.log(`bids get complete: ${eventId}`, dateFormatModule.getByFormat())
    let yesCount = 0, noCount = 0;
    for (let yesItem of bidsPromiseRes[0]) {
        if (!yesItem.error) {
            yesCount += yesItem.data.length;
        }
    }
    for (let noItem of bidsPromiseRes[1]) {
        if (!noItem.error) {
            noCount += noItem.data.length;
        }
    }
    if (yesCount < noCount) {
        matchingTrades(bidsPromiseRes[0], bidsPromiseRes[1])
    } else {
        matchingTrades(bidsPromiseRes[1], bidsPromiseRes[0])
    }
    console.log(`bids processing complete: ${eventId}`, dateFormatModule.getByFormat())
    return;
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
        bids: [yesFilterObj, noFilterObj]
    }
    newTrades.push(newTread)
}

function mapSetForMatchingTrades(getMap, bitItem, matchBitIds,newTrades) {
    let getMapKey = 10 - bitItem.amount;
    let isBitExist = getMap.get(getMapKey);
    let existBitIndex = isBitExist ? isBitExist.findIndex((item) => item.user_id != bitItem.user_id) : -1
    if (existBitIndex != -1) {
        const existBitData = isBitExist.splice(existBitIndex, 1)[0];
        matchBitIds.push(existBitData.id);
        matchBitIds.push(bitItem.id);
        if (bitItem.choose_option_id == dbConstant.mysql.bids.choose_option_id.yes) {
            storeNewTrade(newTrades, bitItem.event_id, bitItem, existBitData);
        } else {
            storeNewTrade(newTrades, bitItem.event_id, existBitData, bitItem);
        }
        getMap.set(getMapKey, isBitExist)
    }

}

function matchingTrades(setItems, getItems) {
    let setMap = new Map();
    let newTrades=[];
    let matchBitIds=[]
    for (let setItem of setItems) {
        if (!setItem.error) {
            for(let bitItem of setItem.data){
                mapSetForMatchingTrades(setMap, bitItem);
            }
        }
        
    }

    for (let getItem of getItems) {
        if (!getItem.error) {
            for(let bitItem of getItem.data){
                mapSetForMatchingTrades(setMap, bitItem,matchBitIds,newTrades)
            }
        }
    }
    if (matchBitIds.length === 0 || newTrades.length == 0) {
        return;
    }
    // bidsDb.updateMatchIdsStatus(matchBitIds)
    // createTreads(newTrades);

}
this.matchBidsHandler()


function createTreads(newTrades) {
    tradesModel.insertMany(newTrades)

}

function mapSetForUpdateBit(inputMap, bitItem) {
        const inputMapKey = bitItem.amount;
        let setData = [];
        const isMapDataExist = inputMap.get(inputMapKey);
        if (isMapDataExist) {
            setData = isMapDataExist
        }
        setData.push(bitItem)
        inputMap.set(inputMapKey, setData)
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