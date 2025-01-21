const mongoose = require("mongoose")
const conn=require("../db/mongodb/conn.mongodb")
const dbConstant = require("../utils/dbConstant.utils");

const db = new mongoose.Schema({
    eventId: {
        type: mongoose.Types.ObjectId,
        ref: "events",
        index:true
    },
    status: {
        type: Number,
        default: dbConstant.mongodb.treads.status.live,
        index:true
    },
    bits: [
        {
            bitId: {
                type: Number,
                require: true,
                unique:true
            },
            amount: {
                type: Number,
                require: true
            },
            userId: {
                type: String,
                require: true
            },
            userName: {
                type: String,
                require: true
            },
            userPic: {
                type: String,
                require: true
            },
            status: {
                type: Number,
                default: dbConstant.mongodb.treads.bits.status.active,
                index:true
            },
            chooseOptionId: {
                type: Number,
                require: true
            },
            createdDate: {
                type: Date,
                require: true
            }
        }
    ]
},
    {
        timestamps: {
            currentTime: () => new Date().getTime() + 5.5 * 60 * 60 * 1000,
        }
    })

const tradesModel=conn.model("trades",db);
module.exports=tradesModel;