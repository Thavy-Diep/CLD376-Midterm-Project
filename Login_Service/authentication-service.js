const express = require("express");
const app = express();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const dbconnect = require("./dbconnect.js");
const PersonModel = require("./person_schema.js");

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_SECRETE || "development-secret-change-me";

app.post("/login", async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res
      .status(400)
      .json({ message: "email, password and role are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!["admin", "user"].includes(role.toLowerCase())) {
    return res.status(400).json({ message: "role must be admin or user" });
  }

  try {
    const user = await PersonModel.findOne({
      emailid: normalizedEmail,
      role: role.toLowerCase(),
    });

    if (!user || !(await bcrypt.compare(password, user.pass))) {
      return res
        .status(401)
        .json({ message: "Invalid email, password or role" });
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.emailid, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    return res.json({ token });
  } catch (error) {
    return res.status(500).json({ message: "Login service error" });
  }
});

if (require.main === module) {
  app.listen(5002, () => {
    console.log("Authentication Service is running on port 5002");
  });
}

module.exports = app;
