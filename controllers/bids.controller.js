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
        console.log("matching bits end: ", dateFormatModule.getByFormat());
        if (!matchBids) {
            return;
        }
        for (let key in matchBids) { //key means eventId
            if (matchBids[key].yes.length != matchBids[key].no.length) {
                continue;
            }
            if (key == '678a32b155766580508d0784' || key == '678a32b155766580508d0784') {
            updateMatchBit(key, matchBids[key].yes, matchBids[key].no)
            }
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
            action1Limit = isExitBitAmount.totalCount + 1;
            action2Limit = isExitBitAmount.totalCount;
        } else {
            action1Limit = bitItem.total_count
            action2Limit = bitItem.total_count + 1;
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
    let limitMap = new Map();

    for (let yesItem of yesArr) {
        limitMap.set(JSON.stringify([yesItem.amount, yesItem.chooseOptionId]), yesItem.limit)
        yesPromise.push(bidsDb.allMatch(eventId, dbConstant.mysql.bids.choose_option_id.yes, yesItem.amount, yesItem.limit));
    }
    for (let noItem of noArr) {
        limitMap.set(JSON.stringify([noItem.amount, noItem.chooseOptionId]), noItem.limit)
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
        matchingTrades(eventId, bidsPromiseRes[0], bidsPromiseRes[1], dbConstant.mysql.bids.choose_option_id.yes, dbConstant.mysql.bids.choose_option_id.no, limitMap)
    } else {
        matchingTrades(eventId, bidsPromiseRes[1], bidsPromiseRes[0], dbConstant.mysql.bids.choose_option_id.no, dbConstant.mysql.bids.choose_option_id.yes, limitMap)
    }
    console.log(`bids processing complete: ${eventId}`, dateFormatModule.getByFormat())
    return;
}

function storeNewTrade(newTrades, eventId, yesObj, noObj) {
    const yesFilterObj = {
        bidId: yesObj.id,
        userId: yesObj.user_id,
        userName: yesObj.user_name,
        userPic: yesObj.user_pic,
        amount: yesObj.amount,
        chooseOptionId: yesObj.choose_option_id,
        createdDate: yesObj.created_date,
    }
    const noFilterObj = {
        bidId: noObj.id,
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

function mapGetForMatchingTrades(getMap, bitItem, matchBitIds, newTrades) {
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

function mapSetForMatchingTrades(setMap, bitItem) {
    const setMapKey = bitItem.amount;
    let setData = [];
    const isMapDataExist = setMap.get(setMapKey);
    if (isMapDataExist) {
        setData = isMapDataExist
    }
    setData.push(bitItem)
    setMap.set(setMapKey, setData)
}

async function matchingTrades(eventId, setItems, getItems, setOption, getOption, limitMap) {
    let setMap = new Map();
    let newTrades = [];
    let matchBitIds = []
    for (let setItem of setItems) {
        if (!setItem.error) {
            for (let bitItem of setItem.data) {
                mapSetForMatchingTrades(setMap, bitItem);
            }
        }

    }

    for (let getItem of getItems) {
        if (!getItem.error) {
            for (let bitItem of getItem.data) {
                mapGetForMatchingTrades(setMap, bitItem, matchBitIds, newTrades)
            }
        }
    }
    console.log(`before ${dateFormatModule.getByFormat()}:`, {matchBitIds:matchBitIds.length},{newTrades:newTrades.length})
    await matchingToReamingBits(eventId, setMap, getOption, limitMap, matchBitIds, newTrades)
    console.log(`after matchIds ${dateFormatModule.getByFormat()}: `, {matchBitIds:matchBitIds.length},{newTrades:newTrades.length})
    return;

    if (matchBitIds.length === 0 || newTrades.length == 0) {
        return;
    }


    // createTreads(newTrades);
    // updateBidsByIds(matchBitIds);

}

async function matchingToReamingBits(eventId, setMap, getOption, limitMap, matchBitIds, newTrades) {
    console.log("first----")
    let extraGetItemPromise = []
    for (let setMapItem of setMap) {
        if (setMapItem[1].length === 0) {
            setMap.delete(setMapItem[0]);
            continue;
        }
        const limitMapKey = JSON.stringify([constUtils.key.eventTotalPoint - setMapItem[0], getOption]);
        let skip = limitMap.get(limitMapKey)
        if (!skip) {
            continue;
        }
        limitMap.set(limitMapKey, skip + 100) // todo why two time go
        extraGetItemPromise.push(bidsDb.allMatchByLimitAndSkip(eventId, getOption, constUtils.key.eventTotalPoint - setMapItem[0], skip, setMapItem[1].length + 100)) // 0 present key of amount 1 index unMatch obj array
    }
    if (extraGetItemPromise.length !== 0) {
        const extraGetItems = await Promise.all(extraGetItemPromise);
        for (let getItem of extraGetItems) {
            if (getItem.error) {
                setMap.delete(constUtils.key.eventTotalPoint - getItem.data)
                continue;
            }
            for (let bitItem of getItem.data) {
                mapGetForMatchingTrades(setMap, bitItem, matchBitIds, newTrades)
            }
        }
    }
    if (setMap.size > 0) {
        matchingToReamingBits(eventId, setMap, getOption, limitMap, matchBitIds, newTrades)
    }
}

this.matchBidsHandler()


async function createTreads(newTrades) {
    console.log("create treads enter : ", dateFormatModule.getByFormat())
    tradesModel.insertMany(newTrades)

}

async function updateBidsByIds(matchBitIds) {
    console.log("enter in updateBidsByIds : ", dateFormatModule.getByFormat())
    bidsDb.updateMatchIdsStatus(matchBitIds)
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