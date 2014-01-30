angular.module('gapi', [])
    .constant('gapiClientId', '410651232750')
    .constant('gapiKey', 'AIzaSyBlqYPaQsE5t6WE-sRpcf792QULgQuYxzM')
    .constant('gapiScopes', 'https://www.googleapis.com/auth/calendar')

    .factory('calendarClient', function(gapiClientId, gapiKey, gapiScopes) {
        function authorizeUser(callback) {
            gapi.client.setApiKey(gapiKey);

            gapi.auth.authorize({client_id: gapiClientId, scope: gapiScopes, immediate: false}, clientLibraryLoader(callback));
        }

        function clientLibraryLoader(callback) {
            return function loadClientLibrary() {
                gapi.client.load('calendar', 'v3', callback);
            };
        }

        function findCalendar(name, callback) {
            var calendar = null;

            gapi.client.calendar.calendarList.list().execute(function(resp) {
                resp.items.forEach(function(item) {
                    if (item.summary == name) {
                        calendar = item;
                    }
                });

                callback(calendar);
            });

        }

        function createCalendar(name, callback) {
            gapi.client.calendar.calendars.insert({ resource : {
                summary: name
            } }).execute(callback);
        }

        function findOrCreateCalendar(name, callback) {
            findCalendar(name, function orCreateCalendar(calendar) {
                if (calendar === null) {
                    createCalendar(name, callback);
                }
                else {
                    callback(calendar);
                }
            });
        }

        function createEvent(calendarId, event, callback) {
            gapi.client.calendar.events.insert({
                calendarId: calendarId,
                resource: event
            }).execute(callback);
        }



        var calendarClient = {};

        calendarClient.authorizeUser = authorizeUser;
        calendarClient.findOrCreateCalendar = findOrCreateCalendar;
        calendarClient.createCalendar = createCalendar;
        calendarClient.createEvent = createEvent;

        return calendarClient;
    })
;

