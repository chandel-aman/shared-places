const axios = require("axios");
const HttpError = require("../models/http-error");

const ACCESS_TOKEN = process.env.MAP_API_KEY;

const getCoordinatesForAddress = async (address) => {
  const response = await axios.get(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      address
    )}.json?type=poi&limit=1&access_token=${ACCESS_TOKEN}`
  );

  const data = response.data;

  if (!data || data.features.length == 0) {
    const error = new HttpError(
      "Could not find location for the specified address.",
      422
    );
    return next(error);
  }

  const coordinates = [data.features[0].center[0], data.features[0].center[1]];
  return coordinates;
};

module.exports = getCoordinatesForAddress;
