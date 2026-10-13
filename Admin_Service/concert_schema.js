const mongoose = require("mongoose");

const concertSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    artist: { type: String, required: true, trim: true },
    venue: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    price: { type: Number, required: true, min: 0 },
    totalTickets: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    availableTickets: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    description: { type: String, trim: true, default: "" },
  },
  { timestamps: true, collection: "concerts" },
);

module.exports =
  mongoose.models.Concert || mongoose.model("Concert", concertSchema);
