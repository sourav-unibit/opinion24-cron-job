const connection = require("./conn.mysql");
const dbConstant = require("../../utils/dbConstant.utils")
const log = require("../../utils/log.utils")

exports.allUnMatch = () => {
    return new Promise((resolve) => {
        const sqlQuery = `SELECT count (*) as total_count, event_id,choose_option_id,amount FROM bits WHERE status = ? GROUP BY event_id , choose_option_id,amount  `
        connection.query(sqlQuery, dbConstant.mysql.bits.status.unMatch, (error, result) => {
            if (error) {
                log(error)
                return resolve({
                    error: true,
                    message: error.message,
                    data: null
                })
            }
            if (result.length === 0) {
                return resolve({
                    error: true,
                    message: 'not bits found',
                    data: null
                })
            }
            return resolve({
                error: false,
                message: "bits fetch successfully",
                data: result
            })
        })
    })
}

exports.allMatch = (eventId, optionId, amount,limit) => {
    return new Promise((resolve) => {
        const status = dbConstant.mysql.bits.status.unMatch;
        const sqlQuery = `SELECT id,user_id,user_name,user_pic,event_id,amount,choose_option_id,created_date FROM bits WHERE status=? AND event_id = ? AND choose_option_id=? AND amount = ? ORDER BY id asc LIMIT ? `
        connection.query(sqlQuery, [status, eventId, optionId, amount, limit], (error, result) => { 
            if (error) {
                log(error)
                return resolve({
                    error: true,
                    message: error.message,
                    data: null
                })
            }
            if (result.length === 0) {
                return resolve({
                    error: true,
                    message: 'not bits found',
                    data: null
                })
            }
            return resolve({
                error: false,
                message: "bits fetch successfully",
                data: result
            })
        })
    })
}

