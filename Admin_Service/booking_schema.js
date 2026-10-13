const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    concertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Concert",
      required: true,
    },
    userId: { type: String, required: true },
    userEmail: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    totalPrice: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["active", "cancelled"],
      default: "active",
      required: true,
    },
  },
  { timestamps: true, collection: "bookings" },
);

module.exports =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
