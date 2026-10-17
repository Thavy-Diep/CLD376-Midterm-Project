require("dotenv").config();

const express = require("express");
const app = express();
const bcrypt = require("bcryptjs");
const connectDB = require("./dbconnect.js");
const PersonModel = require("./person_schema.js");

app.use(express.json());

// REGISTRATION API
app.post("/userregister", async (req, res) => {
  const { name, firstname, email, password, phone, mobile, role } = req.body;

  if (!(name || firstname) || !email || !password) {
    return res
      .status(400)
      .json({ message: "name, email and password are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedRole = (role || "user").trim().toLowerCase();

  if (!["admin", "user"].includes(normalizedRole)) {
    return res.status(400).json({ message: "role must be admin or user" });
  }

  try {
    const existingUser = await PersonModel.findOne({
      emailid: normalizedEmail,
    });
    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const person = new PersonModel({
      name: name || firstname,
      emailid: normalizedEmail,
      pass: hashedPassword,
      mobile: mobile === undefined ? phone : mobile,
      role: normalizedRole,
    });

    await person.save();
    return res.status(201).json({ message: "Account registered successfully" });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Email is already registered" });
    }
    return res
      .status(500)
      .json({ message: err.message || "Error registering user" });
  }
});

async function start() {
  await connectDB();
  const port = Number(process.env.PORT) || 5001;
  app.listen(port, () => {
    console.log(`Registration Service is running on port ${port}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Unable to start Registration Service", error);
    process.exitCode = 1;
  });
}

module.exports = app;
