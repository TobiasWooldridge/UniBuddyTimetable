var appConfig = {
    apiPath: "http://flindersapi.tobias.pw/api/v1/",
    years: [2013],
    defaultYear: 2013,
    semesters: ["S1", "NS1", "S2", "NS2"],
    defaultSemester: "S2",
    maxTimetableSuggestions: 7
};

angular.module('flindersTimetable.timetable', [
        'ui.state',
        'ui.sortable'
    ])
    .config(function config($stateProvider) {
        $stateProvider.state('home', {
            url: '/',
            views: {
                "main": {
                    controller: 'TimetableCtrl',
                    templateUrl: 'timetable/timetable.tpl.html'
                }
            },
            data: { pageTitle: 'Make your ideal timetable' }
        });
    })

    .controller('TimetableCtrl', function TimetableController($scope, $location, chosenTopicService, urlService, topicFactory) {
        $scope.$on('chosenClassesUpdate', function () {
            urlService.setTopics(chosenTopicService.getTopics());
        });

        var loadFromUrl = function () {
            var newTopicSerials = urlService.getTopics();
            var oldTopics = chosenTopicService.getTopics();

            var topicsToRemove = [];

            angular.forEach(oldTopics, function (oldTopic) {
                var index = newTopicSerials.indexOf(oldTopic.getSerial());

                if (index === -1) {
                    // The old topic should be removed.
                    topicsToRemove.push(oldTopic);
                }
                else {
                    // It isn't actually a new topic! Don't add it later.
                    newTopicSerials.splice(index, 1);
                }
            });

            angular.forEach(topicsToRemove, function (topic) {
                chosenTopicService.removeTopic(topic, false);
            });


            // Don't try to broadcast while we're still asyncronously loading topics.
            var topicsToLoad = newTopicSerials.length;
            var broadcastUpdateWhenReady = function () {
                if (topicsToLoad === 0) {
                    chosenTopicService.broadcastTopicsUpdate();
                }
            };

            // Load all of the new topics
            angular.forEach(newTopicSerials, function (topicSerial) {
                topicFactory.loadTopicFromSerialAsync(topicSerial, function (topic) {
                    topicsToLoad--;

                    chosenTopicService.addTopic(topic, false);
                    broadcastUpdateWhenReady();
                });
            });

            broadcastUpdateWhenReady();
        };

        $scope.$watch(function () {
            return $location.search();
        }, function () {
            loadFromUrl();
        });


        loadFromUrl();
    })

    .filter('secondsToTime', function (moment) {
        return function (number) {
            return moment.unix(number).utc().format('h:mm a');
        };
    })

    .filter('secondsToHours', function (moment) {
        return function (number) {
            var duration = moment.duration(number * 1000);
            var timeInHours = Math.floor(duration.asHours()) + ":" + Math.floor(duration.asMinutes() % 60);

            return timeInHours;
        };
    })


    .factory('hashService', function () {
        var hashService = {
            hash: function (str) {
                var hash = 0, i, c;
                if (str.length === 0) {
                    return hash;
                }
                for (i = 0, l = str.length; i < l; i++) {
                    c = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + c;
                    hash |= 0;
                }
                return Math.abs(hash);
            }
        };

        return hashService;
    })

    .factory('moment', function () {
        return moment;
    })

    .factory('classNameService', function () {
        var classNameService = {};

        classNameService.simplifyName = function (name) {
            // Remove all nasty characters
            name = name.replace(/[^A-Za-z0-9]/g, '');

            name = name.replace(/Computer/g, 'Comp')
                       .replace(/Laboratory/g, 'Lab')
                       .replace(/Tutorial/g, 'Tute')
                       .replace(/Practical/g, 'Prac')
                       .replace(/Project/g, 'Proj');

            return name;
        };

        return classNameService;
    })

    .factory('urlService', function ($location) {
        var defaultState = {
            year: 2013,
            semester: "S2",
            topics: ""
        };

        var state = {};

        var urlService = {};

        var get = function (key) {
            if ($location.search().hasOwnProperty(key)) {
                return $location.search()[key];
            }
            if (defaultState.hasOwnProperty(key)) {
                return defaultState[key];
            }

            return undefined;
        };

        var set = function (key, value) {
            var state = $location.search();

            state[key] = value;

            if (defaultState[key] === value) {
                delete(state[key]);
            }

            $location.search(state);
        };

        urlService.setYear = function (year) {
            set('year', year);
        };

        urlService.getYear = function () {
            return get('year');
        };

        urlService.setSemester = function (semester) {
            set('semester', semester);
        };

        urlService.getSemester = function () {
            return get('semester');
        };

        urlService.setTopics = function (topics) {
            var topicIdentifiers = [];
            angular.forEach(topics, function (topic) {
                topicIdentifiers.push(topic.getSerial());
            });

            set('topics', topicIdentifiers.join('_'));
        };

        urlService.getTopics = function () {
            if (get('topics') === "") {
                return [];
            }

            return get('topics').split('_');
        };

        return urlService;
    })

    .factory('camelCaseService', function () {
        /**
         * Convert a given string to camelCase
         *
         * @param {string} str The string to camelcase
         * @returns {string} str in camelCase
         */
        var camelCase = function (str) {
            return str.toLowerCase().replace(/[_-](.)/g, function (m, g) {
                return g.toUpperCase();
            });
        };

        var that = {};

        /**
         * camelCase all of the keys in an object recursively. Originally designed for dealing with underscore-oriented remote APIs
         *
         * @param object
         * @returns {*} the same object, with all keys in the object recursively camelcased
         */
        that.camelCaseObject = function (object) {
            if (typeof object !== "object") {
                // We can't camelcase the keys of an object
                return;
            }

            var keys = [];
            for (var key in object) {
                keys.push(key);
            }

            for (var i = 0; i < keys.length; i++) {
                var oldKey = keys[i];
                var newKey = camelCase(oldKey);

                if (oldKey !== newKey) {
                    object[newKey] = object[oldKey];
                    delete(object[oldKey]);
                }

                that.camelCaseObject(object[newKey]);
            }

            return object;
        };

        return that;
    })

    .factory('topicFactory', function ($http, sessionsService, camelCaseService, topicService, hashService, classNameService) {
        var baseTopic = {
            getSerial: function () {
                var serial = this.uniqueTopicCode;

                var firstClass = true;

                angular.forEach(this.classes, function (classType) {
                    if (typeof(classType.activeClassGroup) === "undefined") {
                    }
                    else if (classType.classGroups.length <= 1) {
                    }
                    else {
                        serial += firstClass ? "-(" : "-";
                        serial += classNameService.simplifyName(classType.name) + classType.activeClassGroup.groupId;

                        firstClass = false;
                    }
                });

                if (!firstClass) {
                    serial += ")";
                }

                return serial;
            },

            timetableLoaded: false,

            getHash: function () {
                return hashService.hash(this.uniqueTopicCode);
            }
        };

        var topicFactory = {};

        topicFactory.getTopicsAsync = function (query, callback) {
            var url = appConfig.apiPath + 'topics.json' + "?";

            if (typeof query.year !== "undefined" && query.year !== "Any") {
                url += "&year=" + query.year;
            }
            if (typeof query.semester !== "undefined" && query.semester !== "Any") {
                url += "&semester=" + query.semester;
            }
            if (typeof query.subjectArea !== "undefined" && query.subjectArea !== "Any") {
                url += "&subject_area=" + query.subjectArea;
            }
            if (typeof query.topicNumber !== "undefined" && query.topicNumber !== "Any") {
                url += "&topic_number=" + query.topicNumber;
            }

            $http.get(url).success(function (topics, status, headers, config) {

                camelCaseService.camelCaseObject(topics);

                topicService.sortTopics(topics);

                angular.forEach(topics, function (topic) {
                    angular.extend(topic, baseTopic);
                });

                callback(topics, status, headers, config);
            });
        };

        topicFactory.getTopicAsync = function (topicId, callback) {
            var url = appConfig.apiPath + 'topics/' + topicId + '.json';

            $http.get(url).success(function (data, status, headers, config) {
                camelCaseService.camelCaseObject(data);

                callback(data, status, headers, config);
            });
        };

        topicFactory.createTopicFromUniqueTopicCode = function (serial) {
            var syntax = /^(([0-9]{4})\-([A-Z0-9]{1,4})\-([A-Z]{4})([0-9]{4}[A-Z]?))/i;

            var topicIdentifier = syntax.exec(serial);

            if (!topicIdentifier) {
                return false;
            }

            var topic = {
                uniqueTopicCode: topicIdentifier[1],
                year: topicIdentifier[2],
                semester: topicIdentifier[3],
                subjectArea: topicIdentifier[4],
                topicNumber: topicIdentifier[5],
                code: topicIdentifier[4] + topicIdentifier[5]
            };

            return topic;
        };

        topicFactory.loadTopicFromSerialAsync = function (topicSerial, callback) {

            var topic = topicFactory.createTopicFromUniqueTopicCode(topicSerial);

            if (!topic) {
                return false;
            }

            // TODO: Improve the following method (parse string with regex)
            var parens = /\((.*)\)/;

            var bracketSets = parens.exec(topicSerial);

            var hasClassSelections = bracketSets !== null;

            if (hasClassSelections) {
                var getClassesRegex = /([(A-Za-z]+)([0-9]+)-?/g;
                var classSelections = {};

                while (classSelection = getClassesRegex.exec(bracketSets[1])) {
                    classSelections[classSelection[1]] = classSelection[2];
                }
            }


            angular.extend(topic, baseTopic);

            topicFactory.loadTimetableForTopicAsync(topic, function (topic, status, headers, config) {
                if (hasClassSelections) {
                    angular.forEach(topic.classes, function (classType) {
                        var strippedName = classNameService.simplifyName(classType.name);

                        if (typeof classSelections[strippedName] !== "undefined") {
                            classType.activeClassGroup = classType.classGroups[classSelections[strippedName] - 1];
                        }

                    });
                }

                callback(topic, status, headers, config);
            });

            return topic;
        };

        topicFactory.loadTimetableForTopicAsync = function (topic, callback) {
            topicFactory.getTopicAsync(topic.uniqueTopicCode, function (remoteTopicEntry, status, headers, config) {
                angular.extend(topic, remoteTopicEntry);
                topic.timetableLoaded = true;

                angular.forEach(topic.classes, function (classType) {
                    if (classType.classGroups.length > 0) {
                        classType.classGroups.sort(function (a, b) {
                            return a.groupId - b.groupId;
                        });

                        if (typeof classType.activeClassGroup === "undefined") {
                            classType.activeClassGroup = classType.classGroups[0];
                        }
                    }
                });

                callback(topic, status, headers, config);
            });
        };


        return topicFactory;
    })

    .factory('topicService', function (bookingFactory) {
        var that = {};

        that.listBookingsForTopics = function (topics) {
            var bookings = [];

            angular.forEach(topics, function (topic) {
                angular.forEach(topic.classes, function (classType) {
                    if (!classType.activeClassGroup) {
                        return;
                    }
                    angular.forEach(classType.activeClassGroup.classSessions, function (classSession) {
                        bookings.push(bookingFactory.newBooking(topic, classType, classType.activeClassGroup, classSession));
                    });
                });
            });

            return bookings;
        };

        that.listClassTypesForTopics = function (topics) {
            var classTypes = [];

            angular.forEach(topics, function (topic) {
                var classes = topic.classes;
                if (classes) {
                    classTypes = classTypes.concat(classes);
                }
            });

            return classTypes;
        };

        that.listClassGroupsForTopics = function (topics) {
            var classTypes = that.listClassTypesForTopics(topics);

            var classGroups = [];

            angular.forEach(classTypes, function (classType) {
                if (classType.classGroups) {
                    classGroups = classGroups.concat(classType.classGroups);
                }
            });

            return classGroups;
        };

        function compareTopics(a, b) {
            var subjectDifference = a.subjectArea.localeCompare(b.subjectArea);
            if (subjectDifference !== 0) {
                return subjectDifference;
            }

            var topicDifference = a.topicNumber.localeCompare(b.topicNumber);
            if (topicDifference !== 0) {
                return topicDifference;
            }

            return a.name.localeCompare(b.name);
        }

        that.sortTopics = function (topics) {
            return topics.sort(compareTopics);
        };

        return that;
    })

    .factory('timetableFactory', function (dayService) {
        var that = {};

        that.createEmptyTimetable = function () {
            var timetable = {};

            angular.forEach(dayService.days(), function (day) {
                timetable[day] = [];
            });

            return timetable;
        };

        return that;
    })

    .factory('bookingFactory', function () {
        var that = {};

        that.newBooking = function (topic, classType, classGroup, classSession) {
            var booking = {};

            booking.topicHash = topic.getHash();
            booking.topicCode = topic.code;
            booking.className = classType.name;
            booking.dayOfWeek = classSession.dayOfWeek;
            booking.secondsStartsAt = classSession.secondsStartsAt;
            booking.secondsEndsAt = classSession.secondsEndsAt;
            booking.secondsDuration = classSession.secondsDuration;
            booking.locked = classGroup.locked;

            return booking;
        };

        return that;
    })

    .factory('clashGroupFactory', function () {
        var that = {};

        that.newClashGroup = function (firstBooking) {
            var clashGroup = {
                dayOfWeek: firstBooking.dayOfWeek,
                secondsStartsAt: firstBooking.secondsStartsAt,
                secondsEndsAt: firstBooking.secondsEndsAt,

                clashColumns: [],

                addBooking: function (booking) {
                    clashGroup.secondsStartsAt = Math.min(clashGroup.secondsStartsAt, booking.secondsStartsAt);
                    clashGroup.secondsEndsAt = Math.max(clashGroup.secondsEndsAt, booking.secondsEndsAt);


                    var clashColumn = null;
                    if (clashGroup.clashColumns.length > 0) {
                        var latestContestantEnds = 0;
                        angular.forEach(clashGroup.clashColumns, function (contestantColumn) {
                            var contestantColumnEnds = contestantColumn[contestantColumn.length - 1].secondsEndsAt;
                            if (contestantColumnEnds <= booking.secondsStartsAt && contestantColumnEnds > latestContestantEnds) {
                                clashColumn = contestantColumn;
                                latestContestantEnds = contestantColumnEnds;
                            }
                        });
                    }

                    if (clashColumn === null) {
                        clashColumn = [];
                        clashGroup.clashColumns.push(clashColumn);
                    }

                    clashColumn.push(booking);

                    return true;
                }
            };

            clashGroup.addBooking(firstBooking);

            return clashGroup;
        };

        return that;
    })

    .factory('chosenTopicService', function ($rootScope, topicService) {
        // Keep track of unbroadcasted changes
        var dirty = false;

        var chosenTopics = [];

        var getTopicIndex = function (topic) {
            var index = -1;

            angular.forEach(chosenTopics, function (chosenTopic, i) {
                if (chosenTopic.uniqueTopicCode === topic.uniqueTopicCode) {
                    index = i;
                    return false; // break
                }
            });

            return index;
        };


        var that = {};

        that.broadcastTopicsUpdate = function () {
            $rootScope.$broadcast('chosenTopicsUpdate');
            that.broadcastClassesUpdate();
        };

        that.broadcastClassesUpdate = function () {
            dirty = false;

            $rootScope.$broadcast('chosenClassesUpdate');
        };

        that.addTopic = function (topic, broadcast) {
            if (broadcast === undefined) {
                broadcast = true;
            }

            if (!that.topicIsChosen(topic)) {
                chosenTopics.push(topic);

                topicService.sortTopics(chosenTopics);

                dirty = true;
                if (broadcast) {
                    that.broadcastTopicsUpdate();
                }
                else {
                    dirty = true;
                }
            }
        };

        // that.containsTopicCode = function (topicCode) {
        //     angular.forEach(chosenTopics, function (chosenTopic, i) {
        //         if (chosenTopic.uniqueTopicCode === topicCode) {
        //             return true;
        //         }
        //     });

        //     return true;
        // };

        that.getTopicCodes = function () {
            var topicCodes = [];

            angular.forEach(chosenTopics, function (topic) {
                topicCodes.push(topic.getSerial());
            });

            return topicCodes;
        };

        that.topicIsChosen = function (topic) {
            return getTopicIndex(topic) !== -1;
        };

        that.removeTopic = function (topic, broadcast) {
            if (broadcast === undefined) {
                broadcast = true;
            }

            if (that.topicIsChosen(topic)) {
                chosenTopics.splice(getTopicIndex(topic), 1);

                that.broadcastTopicsUpdate();

                if (broadcast) {
                    that.broadcastTopicsUpdate();
                }
                else {
                    dirty = true;
                }
            }
        };

        that.getTopics = function () {
            return chosenTopics;
        };

        return that;
    })

    .factory('sessionsService', function (dayService) {
        var that = {};

        that.compareSessions = function (a, b) {
            // Sort by day
            var daysDifference = dayService.compareDays(a.dayOfWeek, b.dayOfWeek);
            if (daysDifference !== 0) {
                return daysDifference;
            }

            // Sort by starting time of day
            var secondsStartsDifference = a.secondsStartsAt - b.secondsStartsAt;
            if (secondsStartsDifference !== 0) {
                return secondsStartsDifference;
            }


            return a.secondsEndsAt - b.secondsEndsAt;
        };

        that.sortSessions = function (sessions) {
            return sessions.sort(that.compareSessions);
        };

        return that;
    })

    .factory('clashService', function (sessionsService) {
        var clashService = {};


        var sessionClashCache = {};

        var addToSessionClashCache = function (a, b, outcome) {
            if (typeof sessionClashCache[a.id] === "undefined") {
                sessionClashCache[a.id] = {};
            }

            sessionClashCache[a.id][b.id] = outcome;


            if (typeof sessionClashCache[b.id] === "undefined") {
                sessionClashCache[b.id] = {};
            }
            sessionClashCache[b.id][a.id] = outcome;
        };


        clashService.sessionsClash = function (a, b) {
            var secondsClash = 0;

            if (a.dayOfWeek !== b.dayOfWeek) {
                secondsClash = 0;
            }
            else if (a.secondsStartsAt === b.secondsStartsAt) {
                // a and b start at the same time
                // clash's duration is until first ends
                secondsClash = Math.min(a.secondsDuration, b.secondsDuration);
            }
            else if (b.secondsStartsAt <= a.secondsStartsAt && a.secondsStartsAt < b.secondsEndsAt) {
                // a's start is within b's interval
                secondsClash = (Math.max(a.secondsEndsAt, b.secondsEndsAt) - a.secondsStartsAt);
            }
            else if (b.secondsStartsAt < a.secondsEndsAt && a.secondsEndsAt <= b.secondsEndsAt) {
                // a's end is within b's interval
                secondsClash = (a.secondsEndsAt - Math.min(a.secondsStartsAt, b.secondsStartsAt));
            }
            else if (a.secondsStartsAt <= b.secondsStartsAt && b.secondsEndsAt <= a.secondsEndsAt) {
                // a wraps b
                secondsClash = b.secondsDuration;
            }
            else if (b.secondsStartsAt <= a.secondsStartsAt && a.secondsEndsAt <= b.secondsEndsAt) {
                // b wraps a
                secondsClash = a.secondsDuration;
            }
            else {
                secondsClash = 0;
            }

            return secondsClash;
        };

        var classClashCache = {};

        var addToClassClashCache = function (a, b, outcome) {
            classClashCache[a + ", " + b] = outcome;
            classClashCache[b + ", " + a] = outcome;
        };

        clashService.classGroupsClash = function (a, b) {
            if (typeof classClashCache[a.id + ", " + b.id] === "undefined") {
                var groupSecondsClash = 0;
                var aIndex = 0;
                var bIndex = 0;

                // Assumption: a.classSessions and b.classSessions are sorted
                while (aIndex < a.classSessions.length && bIndex < b.classSessions.length) {
                    var sessionSecondsClash = clashService.sessionsClash(a.classSessions[aIndex], b.classSessions[bIndex]);
                    groupSecondsClash += sessionSecondsClash;

                    // Advance the pointer to whichever class group starts first
                    if (sessionsService.compareSessions(a.classSessions[aIndex], b.classSessions[bIndex]) < 0) {
                        aIndex++;
                    }
                    else {
                        bIndex++;
                    }
                }

                addToClassClashCache(a.id, b.id, groupSecondsClash);
            }

            return classClashCache[a.id + ", " + b.id];
        };

        return clashService;
    })

    .factory('dayService', function () {
        var dayService = {};

        var dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

        var dayIndexes = {};

        // populate dayIndexes
        angular.forEach(dayNames, function (name, index) {
            dayIndexes[name] = index;
        });

        dayService.dayNameToDayOfWeek = function (dayName) {
            return dayIndexes[dayName];
        };

        dayService.dayOfWeekToDayName = function (dayOfWeek) {
            return dayNames[dayOfWeek];
        };

        dayService.days = function () {
            // Copy the array so malicious Russells can't manipulate our internal one
            return dayNames.slice(0);
        };

        dayService.compareDays = function (a, b) {
            return dayService.dayNameToDayOfWeek(a) - dayService.dayNameToDayOfWeek(b);
        };

        return dayService;
    })

    .controller('TopicController', function ($scope, chosenTopicService, topicFactory, urlService) {
        $scope.years = appConfig.years;
        $scope.activeYear = appConfig.defaultYear;

        $scope.semesters = appConfig.semesters;
        $scope.activeSemester = appConfig.defaultSemester;

        $scope.topicSearch = "";

        $scope.chosenTopics = chosenTopicService.getTopics();

        $scope.searchTopics = function (topic) {
            var search = $scope.topicSearch.toLowerCase();

            if (topic === undefined) {
                return false;
            }

            var searchables = [
                topic.code.toLowerCase(),
                topic.name.toLowerCase()
            ];

            var predicates = $scope.topicSearch.toLowerCase().split(' ');

            for (var i = 0; i < predicates.length; i++) {
                var foundPredicate = false;

                for (var j = 0; j < searchables.length; j++) {
                    if (searchables[j].indexOf(predicates[i]) !== -1) {
                        foundPredicate = true;
                        break;
                    }
                }

                if (!foundPredicate) {
                    return false;
                }
            }

            return true;
        };


        var chosenUniqueTopicCodes = function () {
            var uniqueTopicCodes = [];

            angular.forEach(chosenTopicService.chosenTopics, function (topic) {
                uniqueTopicCodes.push(topic.uniqueTopicCode);
            });

            return uniqueTopicCodes;
        };

        var applyTopicSearchFilter = function (newValue) {
            // Keep the currently selected topic selected if it's relevant
            // Or select the first relevant topic
            if ($scope.searchTopics($scope.activeTopic)) {
            }
            else {
                $scope.activeTopic = undefined;

                for (var i = 0; i < $scope.availableTopics.length; i++) {
                    var topic = $scope.availableTopics[i];
                    if ($scope.searchTopics(topic)) {
                        $scope.activeTopic = topic;
                        break;
                    }
                }
            }
        };

        $scope.$watch('topicSearch', function (newValue) {
            applyTopicSearchFilter(newValue);
        });

        $scope.updateAvailableTopics = function () {
            urlService.setSemester($scope.activeSemester);
            urlService.setYear($scope.activeYear);
            $scope.availableTopics = [];

            topicFactory.getTopicsAsync({
                year: $scope.activeYear,
                semester: $scope.activeSemester
            }, function (data) {
                $scope.availableTopics = data;
                applyTopicSearchFilter($scope.topicSearch);
            });
        };


        var topicIdIsSelected = function (topicId) {
            return chosenTopicIds().indexOf(parseInt(topicId, 10)) !== -1;
        };

        $scope.validateTopic = function (topic) {
            if (typeof topic === "undefined") {
                return false;
            }
            else if (chosenTopicService.topicIsChosen(topic)) {
                return false;
            }

            return true;
        };

        $scope.addTopic = function (topic) {
            if (!$scope.validateTopic(topic)) {
                return;
            }

            $scope.topicSearch = "";

            chosenTopicService.addTopic(topic);
            topicFactory.loadTimetableForTopicAsync(topic, function (topic) {
                chosenTopicService.broadcastTopicsUpdate();
            });
        };

        $scope.removeTopic = function (topic) {
            chosenTopicService.removeTopic(topic);
        };


        var loadFromUrl = function () {
            $scope.activeYear = urlService.getYear();

            $scope.activeSemester = urlService.getSemester();
        };


        $scope.updateAvailableTopics();
        loadFromUrl();
    })

    .controller('ManualClassChooserController', function ($scope, chosenTopicService) {
        $scope.broadcastClassesUpdate = chosenTopicService.broadcastClassesUpdate;
        $scope.chosenTopics = chosenTopicService.getTopics();
    })

    .controller('TimetableController', function ($scope, chosenTopicService, timetableFactory, sessionsService, dayService, topicService, clashService, clashGroupFactory) {
        $scope.chosenTopics = [];
        $scope.days = dayService.days();
        $scope.hours = ["8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM"];
        $scope.timetable = timetableFactory.createEmptyTimetable();


        $scope.updateTimetable = function () {
            var timetable = timetableFactory.createEmptyTimetable();

            var bookings = topicService.listBookingsForTopics($scope.chosenTopics);
            bookings = sessionsService.sortSessions(bookings);

            // Remove duplicate bookings where the only difference between the two bookings is the room they're in
            for (var i = 0; i < (bookings.length - 1); i++) {
                var a = bookings[i];
                var b = bookings[i + 1];

                var sessionComparisonFields = ['topicId', 'className', 'dayOfWeek', 'secondsStartsAt', 'secondsEndsAt'];

                var found = true;
                for (var j = 0; j < sessionComparisonFields.length; j++) {
                    var field = sessionComparisonFields[j];
                    if (a[field] !== b[field]) {
                        found = false;
                        break;
                    }
                }

                // Remove the duplicate
                if (found) {
                    bookings.splice(i, 1);
                }
            }


            angular.forEach(bookings, function (booking) {
                var day = booking.dayOfWeek;

                var clashGroups = timetable[day];
                var clashGroup = clashGroups[clashGroups.length - 1];

                if (typeof clashGroup === "undefined" || clashService.sessionsClash(clashGroup, booking) === 0) {
                    clashGroup = clashGroupFactory.newClashGroup(booking);
                    timetable[day].push(clashGroup);
                }
                else {
                    clashGroup.addBooking(booking);
                }
            });

            $scope.timetable = timetable;
        };

        $scope.chosenTopics = chosenTopicService.getTopics();

        $scope.$on('chosenClassesUpdate', function () {
            $scope.updateTimetable();
        });
    })

    .controller('TimetableGeneratorController', function ($scope, chosenTopicService, topicService, clashService) {
        var chosenTopics = chosenTopicService.getTopics();
        $scope.numPossibleTimetables = 1;
        $scope.generatingTimetables = false;

        $scope.timetablePriorities = [];

        $scope.prioritiesSortableOptions = {
            axis : "y"
        };

        var allGeneratedTimetables = [];

        var initializeTimetablePriorities = function() {
            var createTimetablePriority = function(label, sorter) {
                return {
                    label : label,
                    sorter : sorter
                };
            };

            $scope.timetablePriorities.push(createTimetablePriority('Minimize days at uni', function(a, b) {
                return a.daysAtUni - b.daysAtUni;
            }));

            $scope.timetablePriorities.push(createTimetablePriority('Minimize amount of time at uni', function(a, b) {
                return a.secondsAtUni - b.secondsAtUni;
            }));

            $scope.timetablePriorities.push(createTimetablePriority('Start classes earlier', function(a, b) {
                return a.averageStartTime - b.averageStartTime;
            }));

            $scope.timetablePriorities.push(createTimetablePriority('Start classes later', function(a, b) {
                return b.averageStartTime - a.averageStartTime;
            }));
        };
        initializeTimetablePriorities();

        var countPossibleTimetables = function (topics) {
            var possibleTimetables = 1;

            angular.forEach(topics, function (topic) {
                angular.forEach(topic.classes, function (classType) {
                    var groups = classType.classGroups.length;
                    if (groups > 0) {
                        possibleTimetables *= groups;
                    }
                });
            });

            return possibleTimetables;
        };


        $scope.applyClassGroupSelection = function (classGroupSelection) {
            angular.forEach(classGroupSelection, function (entry) {
                entry.classType.activeClassGroup = entry.classGroup;
            });

            chosenTopicService.broadcastClassesUpdate();
        };

        var findTimetablesWithMinimumClashes = function (topics) {
            if (topics.length === 0) {
                return;
            }

            var newClassGroupSelection = function (classType, classGroup) {
                return {
                    classType: classType,
                    classGroup: classGroup
                };
            };

            var allClassGroups = topicService.listClassGroupsForTopics(topics);

            $scope.fewestSecondsClashing = Number.MAX_VALUE;

            var generatedTimetables = [];

            var examineTimetable = function (classGroupSelections, numClashes) {
                if (numClashes < $scope.fewestSecondsClashing) {
                    $scope.fewestSecondsClashing = numClashes;
                    generatedTimetables = [];
                }

                if (numClashes <= $scope.fewestSecondsClashing) {
                    generatedTimetables.push(angular.extend({}, classGroupSelections));
                }
            };


            var searchTimetables = function (previousClassGroupSelections, remainingClassChoices, secondsClashesPrior) {
                var currentClassType = remainingClassChoices.pop();

                angular.forEach(currentClassType.classGroups, function (currentGroup) {
                    var secondsClashesCurrent = secondsClashesPrior;

                    angular.forEach(previousClassGroupSelections, function (previousClassGroupSelection) {
                        var classGroupSecondsClashing = clashService.classGroupsClash(currentGroup, previousClassGroupSelection.classGroup);
                        secondsClashesCurrent += classGroupSecondsClashing;
                    });


                    // Make sure we're not exceeding our clash limit
                    if (secondsClashesCurrent <= $scope.fewestSecondsClashing) {
                        // Work with this group for now
                        previousClassGroupSelections[currentGroup.id] = newClassGroupSelection(currentClassType, currentGroup);

                        if (remainingClassChoices.length === 0) {
                            // No more choices we can make, check if this timetable is good and move on
                            examineTimetable(previousClassGroupSelections, secondsClashesCurrent);
                        } else {
                            // Keep making choices until we find a working timetable
                            searchTimetables(previousClassGroupSelections, remainingClassChoices, secondsClashesCurrent);
                        }

                        // Stop working with the current group
                        delete(previousClassGroupSelections[currentGroup.id]);
                    }
                });

                remainingClassChoices.push(currentClassType);
            };

            var chosenClassGroups = {};
            var remainingClassChoices = [];

            var classTypes = topicService.listClassTypesForTopics(topics);

            angular.forEach(classTypes, function (classType) {
                if (classType.classGroups.length > 0) {
                    remainingClassChoices.push(classType);
                }
            });

            // Keep the user informed of progress
            var startMillis = new Date().getTime();

            searchTimetables(chosenClassGroups, remainingClassChoices, 0);

            $scope.examineDuration = (new Date().getTime() - startMillis) / 1000;

            $scope.numRefinedPossibleTimetables = generatedTimetables.length;

            return generatedTimetables;
        };

        var sortTimetablesByPriorities = function (rawGeneratedTimetables) {

            var classSessionsForClassPicks = function (classPicks) {
                var classSessions = [];

                angular.forEach(classPicks, function (classPick) {
                    classSessions = classSessions.concat(classPick.classGroup.classSessions);
                });

                return classSessions;
            };

            var calculateTimeMetrics = function (timetable) {
                var days = { };

                angular.forEach(timetable.classSessions, function (session) {
                    if (typeof days[session.dayOfWeek] === "undefined") {
                        days[session.dayOfWeek] = {
                            secondsStartsAt: session.secondsStartsAt,
                            secondsEndsAt: session.secondsEndsAt
                        };
                    }
                    else {
                        days[session.dayOfWeek].secondsStartsAt = Math.min(days[session.dayOfWeek].secondsStartsAt, session.secondsStartsAt);
                        days[session.dayOfWeek].secondsEndsAt = Math.max(days[session.dayOfWeek].secondsEndsAt, session.secondsEndsAt);
                    }
                });

                timetable.daysAtUni = 0;
                timetable.secondsAtUni = 0;

                var startTimeSum = 0;
                var endTimeSum = 0;

                angular.forEach(days, function (day) {
                    timetable.daysAtUni++;
                    timetable.secondsAtUni += (day.secondsEndsAt - day.secondsStartsAt);

                    startTimeSum += day.secondsStartsAt;
                    endTimeSum += day.secondsEndsAt;
                });

                timetable.averageStartTime = startTimeSum / timetable.daysAtUni;
                timetable.averageEndTime = endTimeSum / timetable.daysAtUni;

                return timetable;
            };

            var timetables = [];

            // Wrap each timetable and calculate statistics and stuff
            angular.forEach(rawGeneratedTimetables, function (generatedTimetable) {
                var timetable = {};

                timetable.classPicks = generatedTimetable;
                timetable.classSessions = classSessionsForClassPicks(generatedTimetable);

                calculateTimeMetrics(timetable);

                timetables.push(timetable);
            });

            // Sort timetables by the user-defined priorities

            console.log($scope.timetablePriorities);

            timetables.sort(function (a, b) {
                var difference = 0;

                for (var i = 0; i < $scope.timetablePriorities.length; i++) {
                    var priority = $scope.timetablePriorities[i];

                    difference = priority.sorter(a,b);

                    if (difference !== 0) {
                        break;
                    }
                }


                return difference;
            });

            return timetables;
        };

        $scope.generateTimetables = function () {
            allGeneratedTimetables = findTimetablesWithMinimumClashes(chosenTopics);

            allGeneratedTimetables = sortTimetablesByPriorities(allGeneratedTimetables);

            $scope.topTimetableCandidates = allGeneratedTimetables.slice(0, appConfig.maxTimetableSuggestions);

            $scope.hasGeneratedTimetables = true;
        };

        $scope.$on('chosenTopicsUpdate', function () {
            chosenTopics = chosenTopicService.getTopics();
            $scope.hasChosenTopics = (chosenTopics.length > 0);

            $scope.numPossibleTimetables = countPossibleTimetables(chosenTopics);

            $scope.hasGeneratedTimetables = false;
        });
    })
;

