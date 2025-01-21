require("dotenv").config()
const mongoose=require("mongoose")
const conn=mongoose.createConnection(process.env.MONGODB_URL);

conn.on('error', console.error.bind(console, 'connection error:'));

conn.once('open', () => {
  console.log('Connected to MongoDB');
});

module.exports = conn;