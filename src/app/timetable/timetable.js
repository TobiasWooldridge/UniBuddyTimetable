var appConfig = {
    years: [2011, 2012, 2013],
    defaultYear: 2013,
    semesters: ["S1", "NS1", "S2", "NS2"],
    defaultSemester: "S2"
};

angular.module('flindersTimetable.timetable', [
        'ui.state',
        'ui.sortable',
        'flap.topics'
    ])
    .constant('times', {
        years: [2011, 2012, 2013],
        defaultYear: 2013,
        semesters: ["S1", "NS1", "S2", "NS2"],
        defaultSemester: "S2"
    })
    .constant('maxTimetableSuggestions', 7)

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
            if (topic === undefined) {
                return false;
            }

            var name = topic.name.toLowerCase();
            var code = topic.code.toLowerCase();

            var predicates = $scope.topicSearch.toLowerCase().split(' ');

            for (var i = 0; i < predicates.length; i++) {
                // Try searching the topic code
                var matchIndex = code.indexOf(predicates[i]);
                if (matchIndex === 0 || matchIndex === 4) {
                    // Only count these matches if the predicate
                    // * Is 1-4 letters
                    // * Is 1-4 letters followed by numbers (and optionally a letter)
                    // * Is 4 numbers
                    var topicNumberExpression = /^([a-z]{1,4}|[a-z]{4}[0-9]{1,4}[a-z]?|[0-9]{4})$/i;
                    if (topicNumberExpression.test(code)) {
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

    .factory('ArrayMath', function () {
        var self = {
            sum: function (arr) {
                var sum = 0;

                for (var i = 0; i < arr.length; i++) {
                    sum += arr[i];
                }

                return sum;
            },
            mean: function (arr) {
                var sum = self.sum(arr);
                return sum / arr.length;
            },
            variance: function (arr) {
                var sumOfSquares = 0;

                for (var i = 0; i < arr.length; i++) {
                    sumOfSquares += Math.pow(arr[i], 2);
                }

                var variance = sumOfSquares / arr.length - Math.pow(self.mean(arr), 2);

                return variance;
            },
            variability: function (arr) {
                arr = angular.copy(arr);

                arr.sort();

                var previous = arr[0];

                var variability = 0;
                for (var i = 1; i < arr.length; i++) {
                    variability += Math.abs(arr[i] - previous);

                    previous = arr[i];
                }

                return variability;
            }
        };

        return self;
    })

    .controller('TimetableGeneratorController', function ($scope, ArrayMath, chosenTopicService, topicService, clashService, maxTimetableSuggestions, dayService) {
        var chosenTopics = chosenTopicService.getTopics();
        $scope.numPossibleTimetables = 1;
        $scope.generatingTimetables = false;

        $scope.timetablePriorities = [];

        $scope.prioritiesSortableOptions = {
            axis: "y"
        };

        var allGeneratedTimetables = [];

        var initializeTimetablePriorities = function () {
            var createTimetablePriority = function (label, sorter) {
                return {
                    label: label,
                    sorter: sorter
                };
            };

            $scope.timetablePriorities.push(createTimetablePriority('Minimize days at uni', function (a, b) {
                return a.daysAtUni - b.daysAtUni;
            }));

            $scope.timetablePriorities.push(createTimetablePriority('Minimize amount of time at uni', function (a, b) {
                return a.secondsAtUni - b.secondsAtUni;
            }));

            $scope.timetablePriorities.push(createTimetablePriority('Consistent start time', function (a, b) {
                return a.startTimeVariability - b.startTimeVariability;
            }));

            $scope.timetablePriorities.push(createTimetablePriority('Start weekend earlier', function (a, b) {
                return a.weekendStartsAt - b.weekendStartsAt;
            }));

            $scope.timetablePriorities.push(createTimetablePriority('Start classes earlier', function (a, b) {
                return a.averageStartTime - b.averageStartTime;
            }));

            $scope.timetablePriorities.push(createTimetablePriority('Start classes later', function (a, b) {
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
                var secondsInDay = 24 * 60 * 60;

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

                var startTimes = [];
                var endTimes = [];
                var secondsAtUni = [];
                var weekendStartsAt = 0;

                angular.forEach(days, function (day, dayName) {
                    timetable.daysAtUni++;

                    secondsAtUni.push(day.secondsEndsAt - day.secondsStartsAt);

                    startTimes.push(day.secondsStartsAt);
                    endTimes.push(day.secondsEndsAt);

                    weekendStartsAt = Math.max(weekendStartsAt, dayService.dayNameToDayOfWeek(dayName) * secondsInDay + day.secondsEndsAt);
                });

                timetable.secondsAtUni = ArrayMath.sum(secondsAtUni);
                timetable.averageStartTime = ArrayMath.mean(startTimes);
                timetable.averageEndTime = ArrayMath.mean(endTimes);
                timetable.startTimeVariability = ArrayMath.variability(startTimes);
                timetable.weekendStartsAt = weekendStartsAt;

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
            timetables.sort(function (a, b) {
                var difference = 0;

                for (var i = 0; i < $scope.timetablePriorities.length; i++) {
                    var priority = $scope.timetablePriorities[i];

                    difference = priority.sorter(a, b);

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

            $scope.topTimetableCandidates = allGeneratedTimetables.slice(0, maxTimetableSuggestions);

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

