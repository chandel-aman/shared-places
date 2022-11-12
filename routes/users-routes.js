const express = require("express");
const { check } = require("express-validator");

const usersController = require("../controllers/users-controller");
const fileUpload = require('../middleware/file-upload');

const router = express.Router();

router.get("/", usersController.getUsers);

router.post(
  "/signup",
  [
    check("name").not().isEmpty(),
    check("email").normalizeEmail().isEmail(),
    check("password").isLength({ min: 8 }),
  ],
  usersController.signup
);

router.post("/login", usersController.login);

router.patch("/:uId/profileUpdate", fileUpload.single('image'), usersController.updateProfile);

router.patch("/:uId/profileImageDelete", usersController.deleteProfilePic);

router.delete("/:uId/deleteAccount", usersController.deleteUser);

router.post("/:uId/savePlace", usersController.savePlace);

module.exports = router;
