angular.module('gapi', [])
    .constant('gapiClientId', '410651232750')
    .constant('gapiKey', 'AIzaSyBlqYPaQsE5t6WE-sRpcf792QULgQuYxzM')
    .constant('gapiScopes', 'https://www.googleapis.com/auth/calendar')

    // TODO(TobiasWooldridge): Why isn't this a service/provider?
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

        function deleteCalendar(calendar, callback) {
            var p = gapi.client.calendar.calendars["delete"]({ calendarId : calendar.id });
            if (callback) {
                p.execute(callback);
            }
        }

        function listCalendars(callback) {
            gapi.client.calendar.calendarList.list().execute(function(calendars) {
                callback(calendars.items);
            });
        }

        function findCalendar(name, callback) {
            var calendar = null;

            listCalendars(function(resp) {
                angular.forEach(resp, function(item) {
                    if (item.summary == name) {
                        calendar = item;
                    }
                });

                if (callback) {
                    callback(calendar);
                }
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
                    if (callback) {
                        callback(calendar);
                    }
                }
            });
        }

        function createEvent(calendarId, event, callback) {
            var request = gapi.client.calendar.events.insert({
                calendarId: calendarId,
                resource: event
            });

            request.execute(callback || function() {});
        }

        return {
            authorizeUser : authorizeUser,
            listCalendars : listCalendars,
            findCalendar : findCalendar,
            findOrCreateCalendar : findOrCreateCalendar,
            createCalendar : createCalendar,
            createEvent : createEvent
        };
    })
;

