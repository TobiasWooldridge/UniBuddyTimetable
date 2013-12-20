angular.module('flindersTimetable.timetable', [
        'ui.state',
        'ui.sortable',
        'flap.topics',
        'arrayMath',
        'flindersTimetable.generator',
        'flindersTimetable.config'
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
            data: { pageTitle: 'Unofficial Flinders University Timetable Planner' }
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


    .filter('paginate', function () {
        return function (input, pageIndex, itemsPerPage) {
            if (typeof input === "undefined") {
                return input;
            }

            return input.slice(pageIndex * itemsPerPage, (pageIndex + 1) * itemsPerPage);
        };
    })

    .filter('secondsToTime', function (moment) {
        return function (number) {
            return moment.unix(number).utc().format('h:mm a');
        };
    })

    .filter('formatDateTime', function (moment) {
        return function (date) {
            return moment(date, "YYYY-MM-DD h a").format("h A on MMM Do YYYY");
        };
    })

    .filter('inAWeek', function (moment) {
        return function (date) {
            return moment(date, "YYYY-MM-DD h a").add('days', 7).format("YYYY-MM-DD h a");
        };
    })

    .filter('timeDistance', function (moment) {
        return function (date) {
            return moment(date, "YYYY-MM-DD h a").fromNow();
        };
    })

    .filter('secondsToHours', function (moment) {
        return function (number) {
            var duration = moment.duration(number * 1000);

            var hours = "" + Math.floor(duration.asHours());
            var minutes = "" + Math.floor(duration.asMinutes() % 60);

            if (minutes === "0") {
                minutes = "00";
            }

            return hours + ":" + minutes + " hour" + (hours !== '1' ? 's' : '');
        };
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

    .factory('urlService', function ($location, times) {
        var defaultState = {
            year: times.defaultYear,
            semester: times.defaultSemester,
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
            try {
                return parseInt(get('year'), 10);
            }
            catch (e) {
                return defaultState.year;
            }
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

    .factory('displayableTimetableFactory', function (dayService, clashService, sessionsService, clashGroupFactory) {
        var displayableTimetableFactory = {};

        displayableTimetableFactory.createEmptyTimetable = function () {
            var timetable = {};

            angular.forEach(dayService.days(), function (day) {
                timetable[day] = [];
            });

            return timetable;
        };

        displayableTimetableFactory.createTimetableForBookings = function (bookings) {
            var timetable = displayableTimetableFactory.createEmptyTimetable();

            //create timetable stuff
            bookings = sessionsService.sortSessions(bookings.slice(0));

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

            return timetable;
        };

        return displayableTimetableFactory;
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
            booking.locked = classType.classGroups.length == 1;

            return booking;
        };

        var findTopicForClassType = function (topics, selectedClassType) {
            var foundTopic;

            angular.forEach(topics, function (topic) {
                angular.forEach(topic.classes, function (classType) {
                    if (classType.$$hashKey == selectedClassType.$$hashKey) {
                        foundTopic = topic;
                        return false;
                    }
                });

                if (foundTopic !== undefined) {
                    return false;
                }
            });

            return foundTopic;
        };

        that.createBookingsForTopics = function (topics, classSelections) {
            var bookings = [];

            angular.forEach(classSelections, function (selection) {
                angular.forEach(selection.classGroup.classSessions, function (classSession) {
                    var topic = findTopicForClassType(topics, selection.classType);
                    bookings.push(that.newBooking(topic, selection.classType, selection.classGroup, classSession));
                });
            });

            // TODO: Remove all of the following when the current timetable is stored in a classSelection object (instead just return bookings)
            if (bookings.length > 0) {
                return bookings;
            }

            angular.forEach(topics, function (topic) {
                angular.forEach(topic.classes, function (classType) {
                    if (!classType.activeClassGroup) {
                        return;
                    }
                    angular.forEach(classType.activeClassGroup.classSessions, function (classSession) {
                        bookings.push(that.newBooking(topic, classType, classType.activeClassGroup, classSession));
                    });
                });
            });

            return bookings;
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
                duration: firstBooking.duration,

                clashColumns: [],

                addBooking: function (booking) {
                    clashGroup.secondsStartsAt = Math.min(clashGroup.secondsStartsAt, booking.secondsStartsAt);
                    clashGroup.secondsEndsAt = Math.max(clashGroup.secondsEndsAt, booking.secondsEndsAt);
                    clashGroup.duration = clashGroup.secondsEndsAt - clashGroup.secondsStartsAt;

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
            $rootScope.$broadcast('chosenClassesUpdate');
        };

        that.addTopic = function (topic, broadcast) {
            if (broadcast === undefined) {
                broadcast = true;
            }

            if (!that.topicIsChosen(topic)) {
                chosenTopics.push(topic);

                topicService.sortTopics(chosenTopics);

                if (broadcast) {
                    that.broadcastTopicsUpdate();
                }
            }
        };

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
            }
        };

        that.getTopics = function () {
            return chosenTopics;
        };

        return that;
    })


    .factory('clashService', function (sessionsService) {
        var clashService = {};

        var startsInInterval = function (a, b) {
            if (b.secondsStartsAt <= a.secondsStartsAt && a.secondsStartsAt < b.secondsEndsAt) {
                // a's start is within b's interval
                return (Math.min(a.secondsEndsAt, b.secondsEndsAt) - a.secondsStartsAt);
            }
            return 0;
        };

        var endsInInterval = function (a, b) {
            if (b.secondsStartsAt < a.secondsEndsAt && a.secondsEndsAt <= b.secondsEndsAt) {
                // a's end is within b's interval
                return (a.secondsEndsAt - Math.min(a.secondsStartsAt, b.secondsStartsAt));
            }
            return 0;
        };

        var wrapsInterval = function (a, b) {
            if (a.secondsStartsAt <= b.secondsStartsAt && b.secondsEndsAt <= a.secondsEndsAt) {
                // a wraps b
                return b.secondsDuration;
            }
            return 0;
        };


        clashService.sessionsClash = function (a, b) {
            if (a.dayOfWeek !== b.dayOfWeek) {
                return 0;
            }
            else if (a.secondsStartsAt === b.secondsStartsAt) {
                // a and b start at the same time
                // clash's duration is until first ends
                return Math.min(a.secondsDuration, b.secondsDuration);
            }
            //start in interval
            if ((secondsClash = startsInInterval(a, b)) > 0) {
                return secondsClash;
            }
            if ((secondsClash = startsInInterval(b, a)) > 0) {
                return secondsClash;
            }
            //end in interval
            if ((secondsClash = endsInInterval(a, b)) > 0) {
                return secondsClash;
            }
            if ((secondsClash = endsInInterval(b, a)) > 0) {
                return secondsClash;
            }
            //wraps
            if ((secondsClash = wrapsInterval(a, b)) > 0) {
                return secondsClash;
            }
            if ((secondsClash = wrapsInterval(b, a)) > 0) {
                return secondsClash;
            }

            return 0;
        };

        var classClashCache = {};

        var addToClassClashCache = function (a, b, outcome) {
            classClashCache[a + ", " + b] = outcome;
            classClashCache[b + ", " + a] = outcome;
        };

        clashService.sessionArraysClash = function (a, b) {
            var clashDuration = 0;

            angular.forEach(a, function (aSession) {
                angular.forEach(b, function (bSession) {
                    clashDuration += clashService.sessionsClash(aSession, bSession);
                });
            });

            return clashDuration;
        };

        clashService.classGroupsClash = function (a, b) {
            if (a.id === b.id) {
                return 0;
            }

            if (typeof classClashCache[a.id + ", " + b.id] === "undefined") {
                var groupSecondsClash = clashService.sessionArraysClash(a.classSessions, b.classSessions);
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

    .controller('TopicController', function ($scope, times, chosenTopicService, topicFactory, urlService) {
        $scope.years = times.years;
        $scope.activeYear = urlService.getYear();

        $scope.semesters = times.semesters;
        $scope.activeSemester = urlService.getSemester();

        $scope.topicSearch = "";

        $scope.chosenTopics = chosenTopicService.getTopics();

        $scope.searchTopics = function (topic) {
            if (topic === undefined) {
                return false;
            }

            var name = topic.name.toLowerCase();
            var code = topic.code.toLowerCase();

            var predicates = $scope.topicSearch.toLowerCase().split(' ');

            for (var i = 0; i < predicates.length; i++) {
                var predicate = predicates[i];


                // Try searching the topic code
                var matchIndex = code.indexOf(predicate);

                if (matchIndex === 0 || matchIndex === 4) {
                    // Only count these matches if the predicate
                    // * Is 1-4 letters
                    // * Is 1-4 letters followed by numbers (and optionally a letter)
                    // * Is 4 numbers
                    var topicNumberExpression = /^([a-z]{1,4}|[a-z]{4}\d{1,4}[a-z]?|\d{4})$/;
                    var topicNumberMatches = predicate.match(topicNumberExpression);
                    if (topicNumberMatches) {
                        // Predicate matched! Next predicate
                        continue;
                    }
                }

                // Try searching the topic name
                if (name.indexOf(predicates[i]) !== -1) {
                    // Predicate matched! Next predicate
                    continue;
                }


                // Predicate not found
                return false;
            }

            return true;
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

    .directive('timetableMini', function (bookingFactory, displayableTimetableFactory, clashService, dayService, sessionsService, clashGroupFactory) {
        var timetableMini = {
            restrict: 'E',

            scope: {
                topics: '=',
                candidate: '='
            },
            templateUrl: 'timetable/views/timetable-mini.tpl.html',

            link: function ($scope, element, attrs) {
                $scope.days = dayService.days();
                $scope.classSelections = $scope.candidate.classPicks;

                $scope.startOffset = $scope.candidate.stats.earliestStartTime;

                var endTime = $scope.candidate.stats.latestEndTime;

                var duration = endTime - $scope.startOffset;
                duration = duration / 3600;

                $scope.timetableStyle = { height: (duration * 3) + 'em' };

                $scope.updateTimetable = function () {
                    var bookings = bookingFactory.createBookingsForTopics($scope.topics, $scope.classSelections);
                    $scope.timetable = displayableTimetableFactory.createTimetableForBookings(bookings);
                };
                $scope.updateTimetable();

                $scope.$watch('classSelections', $scope.updateTimetable);
                $scope.$watch('topics', $scope.updateTimetable);
            }
        };

        return timetableMini;
    })

    .directive('timetable', function (bookingFactory, displayableTimetableFactory, clashService, dayService, sessionsService, clashGroupFactory) {
        var timetable = {
            restrict: 'E',

            scope: {
                topics: '=',
                classSelections: '='
            },

            templateUrl: 'timetable/views/timetable.tpl.html',

            link: function ($scope, element, attrs) {
                $scope.days = dayService.days();
                $scope.hours = ["8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM"];

                $scope.updateTimetable = function () {
                    var bookings = bookingFactory.createBookingsForTopics($scope.topics, $scope.classSelections);
                    $scope.timetable = displayableTimetableFactory.createTimetableForBookings(bookings);
                };
                $scope.updateTimetable();

                $scope.$watch('classSelections', $scope.updateTimetable);
                $scope.$watch('topics', $scope.updateTimetable);
            }
        };

        return timetable;
    })

    .directive('clashgroup', function () {
        return {
            restrict: 'E',
            scope: {
                clashGroup: '=',
                startOffset: '='
            },
            templateUrl: 'timetable/views/clashGroup.tpl.html'
        };
    })

    .directive('booking', function () {
        var booking = {
            restrict: 'E',
            scope: {
                booking: '=',
                startOffset: '='
            },
            templateUrl: 'timetable/views/booking.tpl.html',
            link: function ($scope, element, attrs) {
                if ($scope.startOffset === undefined) {
                    $scope.startOffset = 28800;
                }
                $scope.getClass = function () {
                    var className = 'booking topic-';
                    className += ($scope.booking.topicHash % 16);
                    if ($scope.booking.locked) {
                        className += ' locked';
                    }
                    return className;
                };

                $scope.getStyle = function () {
                    return {
                        height: ($scope.booking.secondsDuration / (20 * 60)) + 'em',
                        top: (($scope.booking.secondsStartsAt - $scope.startOffset) / (20 * 60)) + 'em'
                    };
                };

            }
        };

        return booking;
    })

    .controller('TimetableController', function ($scope, chosenTopicService, displayableTimetableFactory, sessionsService, dayService, bookingFactory, clashService, clashGroupFactory) {
        $scope.chosenTopics = chosenTopicService.getTopics();
        $scope.$on('chosenClassesUpdate', function () {
            // Note: The slice(0) is used to duplicate the array object to work around angularJS caching the rendered timetable for a given chosenTopics object
            // TODO: Remove this hack, make getTopics() return a new instance of the array every time.
            $scope.chosenTopics = chosenTopicService.getTopics().slice(0);
        });
    })

    .controller('EnrolmentController', function ($scope, chosenTopicService, displayableTimetableFactory, sessionsService, dayService, bookingFactory, clashService, clashGroupFactory) {
        $scope.chosenTopics = chosenTopicService.getTopics();
    })


    .controller('TimetableGeneratorController', function ($scope, $location, $anchorScroll, timetablePossibilityFactory, chosenTopicService, timetablePriorityFactory, timetableGeneratorService, maxTimetablePages, timetablesPerPage) {
        $scope.chosenTopics = chosenTopicService.getTopics();
        $scope.numPossibleTimetables = 1;

        $scope.config = {
            avoidFull: true,
            clashAllowance: 0
        };

        var HOUR = 3600;
        $scope.clashAllowanceChoices = [0, 1 * HOUR, 2 * HOUR, 3 * HOUR];

        $scope.prioritiesSortableOptions = {
            axis: "y"
        };

        $scope.timetablePriorities = timetablePriorityFactory.createAllTimetablePriorities();


        var allGeneratedTimetables = [];

        $scope.movePreference = function (index, movement) {
            var destination = index + movement;

            if (destination >= 0 && destination <= $scope.timetablePriorities.length) {
                var buffer = $scope.timetablePriorities[index];
                $scope.timetablePriorities[index] = $scope.timetablePriorities[destination];
                $scope.timetablePriorities[destination] = buffer;
            }
        };


        $scope.applyClassGroupSelection = function (classGroupSelection) {
            angular.forEach(classGroupSelection, function (entry) {
                entry.classType.activeClassGroup = entry.classGroup;
            });

            chosenTopicService.broadcastClassesUpdate();

            $location.hash('show-timetable');
            $anchorScroll();
            $location.hash('');
        };

        $scope.generateTimetables = function () {
            var startMillis = new Date().getTime();

            allGeneratedTimetables = timetablePossibilityFactory.findTimetablesWithMinimumClashes(chosenTopics, $scope.config);
            $scope.numRefinedPossibleTimetables = allGeneratedTimetables.length;

            allGeneratedTimetables = timetableGeneratorService.sortTimetablesByPriorities(allGeneratedTimetables, $scope.timetablePriorities);

            $scope.topTimetableCandidates = allGeneratedTimetables;
            $scope.pageIndex = 0;
            $scope.numPages = Math.min(maxTimetablePages, Math.ceil(allGeneratedTimetables.length / timetablesPerPage));
            $scope.suggestionsPerPage = timetablesPerPage;

            $scope.hasGeneratedTimetables = true;

            $scope.examineDuration = (new Date().getTime() - startMillis) / 1000;
        };

        $scope.$on('chosenTopicsUpdate', function () {
            chosenTopics = chosenTopicService.getTopics();
            $scope.hasChosenTopics = (chosenTopics.length > 0);

            $scope.numPossibleTimetables = timetablePossibilityFactory.countPossibleTimetables(chosenTopics);

            $scope.hasGeneratedTimetables = false;
        });
    })
;

