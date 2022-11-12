const express = require("express");
const { check } = require("express-validator");

const placesController = require("../controllers/places-controller");
const fileUpload = require('../middleware/file-upload');
const checkAuth = require('../middleware/check-auth');

const router = express.Router();

router.get("/:pId", placesController.getPlacesById);

router.get("/user/:uId", placesController.getPlacesByUserId);

router.use(checkAuth);

router.post(
  "/",
  fileUpload.single('image'),
  [
    check("title").not().isEmpty(),
    check("description").isLength({ min: 5 }),
    check("address").not().isEmpty(),
  ],
  placesController.createPlace
);

router.patch("/:pId",[
  check("title").not().isEmpty(),
  check("description").isLength({ min: 5 }),
  check("address").not().isEmpty(),
], placesController.patchPlace);

router.delete("/:pId", placesController.deletePlace);

module.exports = router;
