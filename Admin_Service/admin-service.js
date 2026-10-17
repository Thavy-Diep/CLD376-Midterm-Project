require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const requireRole = require("./auth");
const connectDB = require("./dbconnect");
const Booking = require("./booking_schema");
const Concert = require("./concert_schema");

const app = express();
app.use(express.json());
app.use(requireRole("admin"));

const editableFields = [
  "title",
  "artist",
  "venue",
  "date",
  "price",
  "totalTickets",
  "description",
];

function sendError(res, error, message) {
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ message: error.message });
  }
  console.error(message, error);
  return res.status(500).json({ message });
}

app.get("/allbookings", async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("concertId")
      .sort({ createdAt: -1 });
    return res.json({ bookings });
  } catch (error) {
    return sendError(res, error, "Unable to load bookings");
  }
});

app.post("/createconcert", async (req, res) => {
  const body = req.body || {};
  try {
    const concert = new Concert({
      title: body.title,
      artist: body.artist,
      venue: body.venue,
      date: body.date,
      price: body.price,
      totalTickets: body.totalTickets,
      availableTickets: body.totalTickets,
      description: body.description,
    });
    await concert.save();
    return res.status(201).json({ concert });
  } catch (error) {
    return sendError(res, error, "Unable to create concert");
  }
});

app.delete("/deleteconcert/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid concert ID" });
  }

  try {
    const concert = await Concert.findById(req.params.id);
    if (!concert) {
      return res.status(404).json({ message: "Concert not found" });
    }

    const activeBooking = await Booking.exists({
      concertId: concert._id,
      status: "active",
    });
    if (activeBooking) {
      return res
        .status(409)
        .json({ message: "Concert has active bookings and cannot be deleted" });
    }

    await concert.deleteOne();
    return res.json({ message: "Concert deleted successfully" });
  } catch (error) {
    return sendError(res, error, "Unable to delete concert");
  }
});

app.put("/updateconcert/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid concert ID" });
  }

  const body = req.body || {};
  const updates = {};
  for (const field of editableFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      updates[field] = body[field];
    }
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: "No concert fields to update" });
  }

  try {
    const concert = await Concert.findById(req.params.id);
    if (!concert) {
      return res.status(404).json({ message: "Concert not found" });
    }

    if (Object.prototype.hasOwnProperty.call(updates, "totalTickets")) {
      const soldTickets = concert.totalTickets - concert.availableTickets;
      if (!Number.isInteger(updates.totalTickets) || updates.totalTickets < soldTickets) {
        return res.status(400).json({
          message: "totalTickets must be an integer greater than or equal to sold tickets",
        });
      }
      concert.availableTickets = updates.totalTickets - soldTickets;
    }

    for (const [field, value] of Object.entries(updates)) {
      concert[field] = value;
    }
    await concert.save();
    return res.json({ concert });
  } catch (error) {
    return sendError(res, error, "Unable to update concert");
  }
});

async function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET must be set");
  }
  await connectDB();
  const port = Number(process.env.PORT) || 5003;
  app.listen(port, () => {
    console.log(`Admin Service is running on port ${port}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Unable to start Admin Service", error);
    process.exitCode = 1;
  });
}

module.exports = app;
