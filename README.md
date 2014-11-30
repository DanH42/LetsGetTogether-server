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
    '{"token": "701263719222018"}'

Assuming the user is logged in, the data returned will contain the user's `name`, `id`, and `image` URL.

### Checking in

Users can check in with their current location at any time. The request must supply the user's `lat`, `lng`, and the location's `accuracy`. The accuracy parameter should be an integer reflecting the number of digits after the decimal should be considered accurate. For example, the location `[-88.1234, 41.6789]` would have an accuracy of `4`.

    POST https://get2gether.me/api/checkin
    '{"token": "701263719222018", "lat": 41.6789, "lng": -88.1234, "accuracy": 4}'

In the future, calling this method should return a list of other nearby users.

Applications
------------

This API level is intended to be used by those interested in bulk statistics. Information obtained at this level should generally not be made public without first being anonymized.

*Details coming soon.*
