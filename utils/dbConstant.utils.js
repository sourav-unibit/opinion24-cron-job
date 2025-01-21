exports.mysql = {
    bits: {
        status: {
            unMatch: 1,
            match: 2,
            exit: 3,
            cancel: 4
        },
        eventStatus: {
            active: 1,
            close: 2
        },
        choose_option_id:{
            yes:1,
            no:2
        }
    }
}

exports.mongodb={
    treads:{
        status:{
            live:1,
            complete:2,
            cancel:3
        },
        bits:{
            status:{
                active:1,
                inActive:2
            }
        }
    }
}