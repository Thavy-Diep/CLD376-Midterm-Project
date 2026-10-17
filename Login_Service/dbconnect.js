const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI must be set");
  }

  await mongoose.connect(uri, {
    serverApi: { version: "1", strict: true, deprecationErrors: true },
  });
  await mongoose.connection.db.admin().command({ ping: 1 });
  console.log("Connected to MongoDB");
}

module.exports = connectDB;
