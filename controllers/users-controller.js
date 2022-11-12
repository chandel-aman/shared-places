const fs = require("fs");

const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const HttpError = require("../models/http-error");
const User = require("../models/user");
const Place = require("../models/place");
const { default: mongoose } = require("mongoose");

// Fetching the registered users from the data base

const getUsers = async (req, res, next) => {
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
  res.json({ users: users.map((u) => u.toObject({ getters: true })) });
};

// Registring the users with their email, password and name

const signup = async (req, res, next) => {
  const error = validationResult(req);

  if (!error.isEmpty()) {
    throw new HttpError("Invalid user input, please check your data!", 422);
  }

  const { name, email, password, places } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (error) {
    const err = new HttpError("Singing up failed, please try again.", 422);
    return next(err);
  }

  if (existingUser) {
    return next(
      new HttpError("Email already registered, please login instead.", 422)
    );
  }

  // hashing the plain password
  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    const error = new HttpError(
      "Could not create the user, please try again later."
    );
    return next(error);
  }

  // Creating a user if the email is not registered already

  const createdUser = new User({
    name,
    email,
    password: hashedPassword,
    image: "uploads/images/user-profile-default.png",
    places,
  });

  try {
    await createdUser.save();
  } catch (error) {
    console.log(error);
    return next(new HttpError("Signing up failed, please try again.", 500));
  }

  let token;
  try {
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email },
      process.env.JWT_PRIVATE_KEY,
      { expiresIn: "1h" }
    );
  } catch (err) {
    return next(
      new HttpError("Signing up failed, please try again later.", 500)
    );
  }

  res
    .status(201)
    .json({ userId: createdUser.id, email: createdUser.email, token: token });
};

// Logining a user with email and password

const login = async (req, res, next) => {
  const { email, password } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    return next(new HttpError("Something went wrong, could not log in.", 500));
  }

  if (!existingUser) {
    return next(
      new HttpError(
        "Could not identify the user, credential seems to be wrong.",
        403
      )
    );
  }

  let passwordIsValid = false;
  try {
    passwordIsValid = await bcrypt.compare(password, existingUser.password);
  } catch (error) {
    return next(
      new HttpError(
        "Could not log you in, please check your credentials and try again."
      )
    );
  }

  if (!passwordIsValid) {
    return next(
      new HttpError(
        "Could not identify the user, credential seems to be wrong.",
        403
      )
    );
  }

  let token;
  try {
    token = jwt.sign(
      { userId: existingUser.id, email: existingUser.email },
      process.env.JWT_PRIVATE_KEY,
      { expiresIn: "1h" }
    );
  } catch (err) {
    return next(
      new HttpError("Loging in failed, please try again later.", 500)
    );
  }

  res
    .status(201)
    .json({ userId: existingUser.id, email: existingUser.email, token });
};

//updating the profile picture of the user

const updateProfile = async (req, res, next) => {
  const userId = req.params.uId;

  let user;
  try {
    user = await User.findById(userId, "-password");
  } catch (error) {
    return next(
      new HttpError(
        "Something went wrong, could not find the user with this id."
      )
    );
  }

  user.image = req.file.path;

  try {
    await user.save();
  } catch (error) {
    return next(
      new HttpError(
        "Something went wrong, could not save the updated user.",
        500
      )
    );
  }
  res.status(200).json({ userId: user.id });
};

// deleting the profile picture of the user

const deleteProfilePic = async (req, res, next) => {
  const userId = req.params.uId;

  let user;
  try {
    user = await User.findById(userId, "-password");
  } catch (error) {
    return next(
      new HttpError(
        "Something went wrong, could not find the user with this id."
      )
    );
  }

  //deleting the current profile picture
  fs.rm(user.image, (err) => {});

  //updating the profile picture to default picture
  user.image = "uploads/images/user-profile-default.png";

  try {
    await user.save();
  } catch (error) {
    return next(
      new HttpError(
        "Something went wrong, could not save the updated user.",
        500
      )
    );
  }
  res.status(200).json({ message: "Image deleted." });
};

// to delete the user
const deleteUser = async (req, res, next) => {

  console.log("\nDELETE request for user.");

  //storing the user id from the request url
  const userId = req.params.uId;
  //storing the password entered by the user from the request body
  const { password } = req.body;

  //verifing wheather the user is present in the database and storing the user
  let user;
  try {
    user = await User.findById(userId);
  } catch (error) {
    return next(
      new HttpError("Something went wrong, could not identify you.", 500)
    );
  }

  //getting all the users from the databse
  let users;
  try {
    users = await User.find({}, "-password");
  } catch (error) {
    return next(
      new HttpError("Fetching of users failed, please try again later.", 500)
    );
  }

  //getting all the places
  let places;
  try {
    places = await Place.find({});
  } catch (error) {
    return next(
      new HttpError("Fetching of places failed, please try again later.", 500)
    );
  }

  //if the user is not present in the database show error
  if (!user) {
    return next(new HttpError("Could not identify you.", 403));
  }

  //then verifying the user entered password with the password stored in the database of the user
  let passwordIsValid = false;
  try {
    //decrypting the hashed password stored in the database
    passwordIsValid = await bcrypt.compare(password, user.password);
  } catch (error) {
    return next(
      new HttpError(
        "Something went wrong, could not proceed with your request."
      )
    );
  }

  //throw error if the password does not match
  if (!passwordIsValid) {
    return next(
      new HttpError(
        "Could not identify you, credential seems to be wrong.",
        403
      )
    );
  }

  //deleting the user if the password is valid

  if (passwordIsValid) {
    if (user.image.toString() !== "uploads/image/user-profile-default.png") {
      fs.rm(user.image, (err) => {
        console.log(err);
      });
    }
    // deleting the image of the place
    places.forEach((place) => {
      if (place) {
        if (place.creator.toString() === userId.toString()) {
          fs.rm(place.image, (error) => {
            console.log(error);
          });
        }
      }
    });

    //using session and transaction
    try {
      //creating a session
      const session = await mongoose.startSession();
      session.startTransaction();

      //removing the user id from the saved list of places of other users
      places.forEach((place) => {
        place.saved.forEach(async (uid) => {
          if (uid.toString() === userId.toString()) {
            place.saved.pull(uid);
            await place.save({ session });
          }
        });
      });

      //first deleting the places of the user from the database
      user.places.forEach(async (p) => {
        //getting the place with place id stored
        const place = Place.findById(p);

        //removing this place from the saved places of all the users
        users.forEach((u) => {
          u.savedPlaces.forEach(async (sp) => {
            //if the place to be deleted has the same id as the one saved in the list of saved places
            if (sp.id === p.toString()) {
              //pulling out the saved place
              u.savedPlaces.pull(sp);
              //saving the updated user
              await u.save({ session });
            }
          });
        });

        //now deleting the place itself
        await place.deleteOne({ session });
    
        // await user.places.save({ session });

        // console.log(place.image+"3");
      });

      //now deleting the user from the all users list
      await user.deleteOne({ session });
      //saving the updated list of users
      // await users.save({session});

      //commiting the transaction
      await session.commitTransaction();
    } catch (error) {
      console.log(error);
      return next(
        new HttpError("Something went wrong, could not delete the user.", 500)
      );
    }
  }
  res.status(200).json({ message: "User deleted!" });
};

//save a place which does not belongs to the user
const savePlace = async (req, res, next) => {
  const userId = req.params.uId;

  const { savedPlacePlaceId } = req.body;

  let user;
  try {
    user = await User.findById(userId, "-password");
  } catch (error) {
    return next(
      new HttpError(
        "Something went wrong, could not find the user with this id."
      )
    );
  }

  let savedPlacePlace;
  try {
    savedPlacePlace = await Place.findById(savedPlacePlaceId);
  } catch (error) {
    return next(
      new HttpError(
        "Something went wrong, could not get the place to be saved.",
        500
      )
    );
  }

  //if the saved places array of the user is not empty and the user has already saved this place
  let savedPlace;
  if (user.savedPlaces.length !== 0) {
    savedPlace = user.savedPlaces.find(
      (place) => place.id === savedPlacePlaceId
    );
  }

  //if the place to be saved is not saved already
  try {
    if (!savedPlace) {
      user.savedPlaces.push(savedPlacePlace.toObject({ getters: true }));
      await user.save();
      savedPlacePlace.saved.push(userId);
      await savedPlacePlace.save();
    }
  } catch (error) {
    return next(new HttpError("Saving place failed, please try again later."));
  }

  res.status(201).json({ message: "Place saved." });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
exports.updateProfile = updateProfile;
exports.deleteUser = deleteUser;
exports.savePlace = savePlace;
exports.deleteProfilePic = deleteProfilePic;
