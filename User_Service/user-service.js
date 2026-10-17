require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const requireRole = require("./auth");
const connectDB = require("./dbconnect");
const Booking = require("./booking_schema");
const Concert = require("./concert_schema");

const app = express();
app.use(express.json());

function userIdFromToken(user) {
  return String(user.id || user.sub || user.email || "");
}

function sendError(res, error, message) {
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ message: error.message });
  }
  console.error(message, error);
  return res.status(500).json({ message });
}

app.get("/allconcert", async (req, res) => {
  try {
    const concerts = await Concert.find({
      date: { $gte: new Date() },
      availableTickets: { $gt: 0 },
    }).sort({ date: 1 });
    return res.json({ concerts });
  } catch (error) {
    return sendError(res, error, "Unable to load concerts");
  }
});

app.post("/bookticket", requireRole("user"), async (req, res) => {
  const body = req.body || {};
  const { concertId, quantity } = body;
  if (!mongoose.isValidObjectId(concertId)) {
    return res.status(400).json({ message: "A valid concertId is required" });
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ message: "quantity must be a positive integer" });
  }

  let reservedConcert;
  try {
    reservedConcert = await Concert.findOneAndUpdate(
      {
        _id: concertId,
        date: { $gte: new Date() },
        availableTickets: { $gte: quantity },
      },
      { $inc: { availableTickets: -quantity } },
      { new: true },
    );
    if (!reservedConcert) {
      const concertExists = await Concert.exists({ _id: concertId });
      if (!concertExists) {
        return res.status(404).json({ message: "Concert not found" });
      }
      return res.status(409).json({
        message: "Concert is unavailable or does not have enough tickets",
      });
    }

    const booking = new Booking({
      concertId: reservedConcert._id,
      userId: userIdFromToken(req.user),
      userEmail: req.user.email,
      quantity,
      totalPrice: reservedConcert.price * quantity,
    });
    await booking.save();
    return res.status(201).json({ booking });
  } catch (error) {
    if (reservedConcert) {
      try {
        const inventoryUpdate = await Concert.updateOne(
          { _id: reservedConcert._id },
          { $inc: { availableTickets: quantity } },
        );
        if (inventoryUpdate.matchedCount !== 1) {
          throw new Error("Concert inventory could not be restored");
        }
      } catch (rollbackError) {
        console.error("Unable to restore ticket inventory after booking error", rollbackError);
        return res
          .status(500)
          .json({ message: "Booking failed and ticket inventory recovery failed" });
      }
    }
    return sendError(res, error, "Unable to book tickets");
  }
});

app.patch("/cancelticket/:id", requireRole("user"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid booking ID" });
  }

  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.userId !== userIdFromToken(req.user)) {
      return res.status(403).json({ message: "You can only cancel your own bookings" });
    }
    if (booking.status !== "active") {
      return res.status(409).json({ message: "Booking is already cancelled" });
    }

    const cancelledBooking = await Booking.findOneAndUpdate(
      { _id: booking._id, userId: booking.userId, status: "active" },
      { $set: { status: "cancelled" } },
      { new: true },
    );
    if (!cancelledBooking) {
      return res.status(409).json({ message: "Booking is already cancelled" });
    }

    try {
      const inventoryUpdate = await Concert.updateOne(
        {
          _id: booking.concertId,
          $expr: {
            $lte: [
              { $add: ["$availableTickets", booking.quantity] },
              "$totalTickets",
            ],
          },
        },
        { $inc: { availableTickets: booking.quantity } },
      );
      if (inventoryUpdate.matchedCount !== 1) {
        throw new Error("Concert inventory could not be restored");
      }
    } catch (inventoryError) {
      console.error("Unable to restore ticket inventory after cancellation", inventoryError);
      try {
        await Booking.updateOne(
          { _id: booking._id, status: "cancelled" },
          { $set: { status: "active" } },
        );
      } catch (rollbackError) {
        console.error("Unable to restore booking status after cancellation error", rollbackError);
      }
      return res.status(500).json({ message: "Unable to cancel booking and restore tickets" });
    }

    return res.json({ booking: cancelledBooking });
  } catch (error) {
    return sendError(res, error, "Unable to cancel booking");
  }
});

async function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET must be set");
  }
  await connectDB();
  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => {
    console.log(`User Service is running on port ${port}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Unable to start User Service", error);
    process.exitCode = 1;
  });
}

module.exports = app;
