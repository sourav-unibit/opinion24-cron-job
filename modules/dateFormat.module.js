const dateFormat = require("dateformat").default;

const moduleExports = {}

moduleExports.getByFormat = function ({ date, format } = { date: new Date(), format: "yyyy-mm-dd H:MM:ss" }) {
    return dateFormat(new Date(date.toString()).toLocaleString("en-US", {
        timeZone: "Asia/Calcutta",
    }), format);
}

module.exports = moduleExports;