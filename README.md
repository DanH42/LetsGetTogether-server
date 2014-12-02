Let's Get Together API Documentation
====================================

This API has two levels:

- **Logged-in user:** This level only needs a user's credentials, but can only get/set information about that user. Only nearby users can be searched.
- **Application:** This level requires a special API key, but can access the information of all users, regardless of location. Information can only be retrieved, not set.

All requests to either API level should be made via POST to `https://get2gether.me/api/[method]`, and their payload should be JSON-encoded. Responses will also be JSON-encoded, and will follow one of the two formats:

    {"success": false, "error": "Message in plain English"}
    {"success": true, "data": {/* Method-specific data */}}

Logged-in Users
---------------

This is the API level used by user-facing interfaces like get2gether.me and the mobile app. All requests at this level must be authenticated using the user's access token, which can change from session to session.

### Getting User Data

Once you have a user's access token, the following method can be used to retrieve that user's personal data:

    POST https://get2gether.me/api/getUserData
    {"token": "ce8190...6a84a5"}

The following fields will be available:

             id: The user's unique numeric ID
           name: The user's first and last name
          image: A link to the user's profile picture (100x100 px)
       location: An array of length 2 with the user's latitude and longitude as floats, or empty ([]) if the user has never checked in
       accuracy: The accuracy given when the user last checked in (0 if they never have)
    lastCheckIn: The timestamp, in seconds, that the user last checked in (0 if they never have)

### Checking In

Users can check in with their current location at any time. The request must supply the user's `lat`, `lng`, and the location's `accuracy`. The accuracy parameter should be an integer reflecting the number of digits after the decimal that should be considered accurate. For example, the location `[-87.6316, 41.8792]` would have an accuracy of `4`.

    POST https://get2gether.me/api/checkin
    {"token": "ce8190...6a84a5", "lat": 41.8792, "lng": -87.6316, "accuracy": 4}

Once the user's location has been updated, you will receive a response containing the information of up to 10 users that are within 30 miles of their location (sorted by distance). A user may not check in twice in a 10-second period.

### Logging Out

To log out your current session:

    POST https://get2gether.me/api/logout
    {"token": "ce8190...6a84a5"}

Calling this method will imediately de-authorize the given token, and all subsequent calls using that token will fail. You can also log out *all* sessions for your current user, regardless of the token they're using:

    POST https://get2gether.me/api/logoutAll
    {"token": "ce8190...6a84a5"}

Applications
------------

This API level is intended to be used by those interested in bulk statistics. Information obtained at this level should generally not be made public without first being anonymized. All requests at this level must be authenticated using an API key.

### Verifying credentials

To programmatically ensure that your API key is valid, active, and allowed to make queries, the following helper method is available:

    POST https://get2gether.me/api/checkAuth
    {"apiKey": "698d452e-3542-47eb-065c-cb6214d7541d"}

The example API key provided is valid but disabled, meaning you should get the following response:

    {"success": false, "error": "Your API access has been disabled"}

### Listing users

Your application can list nearby users by providing a location and either a maximum limit (`num`) or a `radius`. The radius is defined by degrees of latitude. To get all users within .1 degrees (about 7 miles) of downtown Chicago, the following request would be used:

    POST https://get2gether.me/api/getUsers
    {"apiKey": "698d452e-3542-47eb-065c-cb6214d7541d", "lat": 41.879215, "lng": -87.631636, "radius": 0.1}

To return the 5 users closest to the downtown area, just replace `radius` with `num`:

    POST https://get2gether.me/api/getUsers
    {"apiKey": "698d452e-3542-47eb-065c-cb6214d7541d", "lat": 41.879215, "lng": -87.631636, "num": 5}
