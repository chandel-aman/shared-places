const mongoose = require("mongoose");
const fs = require("fs");

const { validationResult } = require("express-validator");

const HttpError = require("../models/http-error");
const getCoordinatesForAddress = require("../utility/location");
const Place = require("../models/place");
const User = require("../models/user");

// Fetching a place from the database using the place id.

const getPlacesById = async (req, res, next) => {
  console.log("GET request in places.");
  const placeId = req.params.pId;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (error) {
    const err = new HttpError(
      "Something went wrong, could not find the place",
      500
    );
    return next(err);
  }

  if (!place) {
    const error = new HttpError(
      "Could not find a place with the provided place id!",
      404
    );
    return next(error);
  }
  res.json({ place: place.toObject({ getters: true }) });
};

// Fetching all the places for a user using the user id

const getPlacesByUserId = async (req, res, next) => {
  console.log("Get request for users.");
  const userId = req.params.uId;

  let places;
  try {
    // places = await Place.find({ creator: userId }); // find method returns an array

    //using poppulate methode to get all the places of the user
    places = await User.findById(userId).populate("places");
  } catch (error) {
    return next(
      new HttpError("Fetching went wrong, could not find a place.", 500)
    );
  }

  if (!places) {
    return next(
      new HttpError("Could not find a place with the provided user id!", 404)
    );
  }
  res.json({ places: places.places.map((p) => p.toObject({ getters: true })) });
};

// Storing a place on the database

const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log("here");
    return next(
      new HttpError("Invalid user input, please check your data!", 422)
    );
  }

  const { title, description, address } = req.body;

  let coordinates;
  try {
    coordinates = await getCoordinatesForAddress(address);
  } catch (error) {
    return next(
      new HttpError("Could not get the coordinates for the given address.")
    );
  }

  const createdPlace = new Place({
    title,
    description,
    location: coordinates,
    address,
    image: req.file.path,
    creator: req.userData.userId,
  });

  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError(
      "Creating place failed, please try again.",
      500
    );
    return next(error);
  }

  if (!user) {
    return next(
      new HttpError("Could not find the user for the provided id.", 404)
    );
  }

  /** A session is what we use to interact with the database and the transaction is the boundry of session
   * here created place is the session
   * and the whole process of creation is the transaction for this session
   */

  try {
    const session = await mongoose.startSession();
    //starting the transaction on this session
    session.startTransaction();
    //storing the created place in the database
    await createdPlace.save({ session });
    //adding the place id to the user's places' array
    user.places.push(createdPlace);
    //saving the user data
    await user.save({ session });
    //commiting the transaction
    session.commitTransaction();
  } catch (error) {
    const err = new HttpError("Creating place failed, please try again!", 500);
    return next(err);
  }

  res.status(201).json({ place: createdPlace });
};

// Updating a place from the database

const patchPlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors);
    return next(
      new HttpError("Invalid user input, please check your data!", 422)
    );
  }

  const { title, description, address } = req.body;
  const placeId = req.params.pId;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (error) {
    return next(
      new HttpError("Something went wrong, could not find the place.", 500)
    );
  }

  if (place.creator.toString() !== req.userData.userId) {
    const error = new HttpError("You are not allowed to edit this place.", 401);
    return next(error);
  }

  let coordinates;
  try {
    coordinates = await getCoordinatesForAddress(address);
  } catch (error) {
    return next(error);
  }

  place.title = title;
  place.description = description;
  place.address = address;
  place.location = coordinates;

  try {
    await place.save();
  } catch (error) {
    return next(
      new HttpError(
        "Something went wrong, could not save the updated place.",
        500
      )
    );
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

// Deleting a place from the database

const deletePlace = async (req, res, next) => {
  const placeId = req.params.pId;
  let place;
  try {
    place = await Place.findById(placeId).populate("creator");
  } catch (error) {
    return next(
      new HttpError(
        "Something went wrong, could not find the place for deletion.",
        500
      )
    );
  }

  //if the place is not present
  if (!place) {
    return next(
      new HttpError("Could not find the place with provided id.", 404)
    );
  }

  if (place.creator.id.toString() !== req.userData.userId) {
    const error = new HttpError(
      "You are not allowed to delete this place.",
      401
    );
    return next(error);
  }

  let users;
  try {
    users = await User.find({}, "-password");
  } catch (err) {
    const error = new HttpError(
      "Fetching users failed, please try again later.",
      500
    );
    return next(error);
  }

  /** Since we have to pull out the saved place from every user and delete the place from the list of places of creator, we will be doing multiple task simultaneously so we require a session in which we can perform these activities. */

  try {
    //creating a session
    const session = await mongoose.startSession();
    session.startTransaction();

    //removing the place from the saved places of all the user
    users.map((u) => {
      u.savedPlaces.map(async (sp) => {
        //if the place to be deleted has the same id as the one saved in the list of saved places
        if (sp.id === placeId) {
          //pulling out the saved place
          u.savedPlaces.pull(sp);
          //saving the updated user
          await u.save({ session });
        }
      });
    });

    await place.remove({ session });
    place.creator.places.pull(place);
    await place.creator.save({ session });
    await session.commitTransaction();
  } catch (error) {
    console.log(error);
    return next(
      new HttpError("Something went wrong, could not delete the place.", 500)
    );
  }

  //deleting the picture of that place
  fs.rm(place.image, (error) => {
    console.log(error);
  });

  res.status(200).json({ message: "Place deleted." });
};

exports.getPlacesById = getPlacesById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.patchPlace = patchPlace;
exports.deletePlace = deletePlace;
