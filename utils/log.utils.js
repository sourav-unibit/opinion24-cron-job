const log=(data)=>{
    if(process.env.SERVER_ENV=="dev"){
        console.log(data)
    }
    return;
}

module.exports=log;