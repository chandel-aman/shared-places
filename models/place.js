const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const placeSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  address: { type: String, required: true },
  location: [
    { type: Number, required: true },
    { type: Number, required: true },
  ],
  image: { type: String, required: true },
  creator: { type: mongoose.Types.ObjectId, required: true, ref: "User" },
  saved: [{ type: mongoose.Types.ObjectId }],
});

module.exports = mongoose.model("Place", placeSchema);
