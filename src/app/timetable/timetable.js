var appConfig = {
    apiPath: "http://flindersapi.tobias.pw/api/v1/",
    years: [2013],
    defaultYear: 2013,
    semesters: ["S1", "NS1", "S2", "NS2"],
    defaultSemester: "S2"
};

angular.module('flindersTimetable.timetable', [
        'ui.state'
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

    .controller('TimetableCtrl', function TimetableController($scope,chosenTopicService,urlFactory) {
        $scope.$on('chosenTopicsUpdate', function() {
            urlFactory.set('topics', chosenTopicService.getTopics());
        });
    })

    .filter('toTime', function () {
        return function (number) {
            return moment.unix(number).utc().format('h:mm a');
        };
    })

    .factory('urlFactory', function($location) {
        var urlFactory = {};

        var state = {};

        var setHash = function(url) {
            $location.search(url);
        };

        urlFactory.get = function (setting) {
            var query = $location.search();

            if (typeof state === "undefined") {
                state = {};
                if (typeof query.year !== "undefined") {
                    state.year = parseInt(query.year, 10);
                }
                state.semester = query.semester;

                if (typeof query.topics !== "undefined") {
                    state.topics = query.topics.split('_');
                }
            }
            if (setting === 'year') {
                return state.year;
            }
            else if (setting === 'semester') {
                return state.semester;
            }
            else if (setting === 'topics') {
                return state.topics;
            }
        };

        urlFactory.set = function(setting, value) {
            if (setting === "year") {
                if (value === appConfig.defaultYear) {
                    delete(state.year);
                }
                else {
                    state.year = value;
                }
            }
            else if (setting === 'semester') {
                if (value === appConfig.defaultSemester) {
                    delete(state.semester);
                }
                else {
                    state.semester = value;
                }
            }
            else if (setting === 'topics') {
                var topicIdentifiers = [];
                angular.forEach(value, function(topic) {
                    topicIdentifiers.push(topic.getUniqueTopicCode());
                });

                if (topicIdentifiers.length > 0) {
                    state.topics = topicIdentifiers.join('_');
                }
                else {
                    delete(state.topics);
                }
            }

            updateURL();
        };

        var updateURL = function() {
            setHash(state);
        };


        return urlFactory;
    })

    .factory('camelCaseService', function () {
        var camelCase = function (str) {
            return str.toLowerCase().replace(/[_-](.)/g, function (m, g) {
                return g.toUpperCase();
            });
        };

        var that = {};

        that.camelCaseObject = function (object) {
            if (typeof object !== "object") {
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

    .factory('topicFactory', function ($http, sessionsService, camelCaseService, topicService) {
        var baseTopic = {
            getUniqueTopicCode: function () {
                // TODO: Add this to FlindersAPI2 https://github.com/TobiasWooldridge/FlindersAPI2/issues/12
                return this.year + '-' + this.semester + '-' + this.code;
            }
        };

        var topicFactory = {};

        topicFactory.getTopicByUniqueTopicCodeAsync = function (uniqueTopicCode, callback) {
            // TODO: Add this to FlindersAPI2 https://github.com/TobiasWooldridge/FlindersAPI2/issues/12
            // Only gets a thin version of a topic, not all details (e.g. topic desc.)

            var syntax = /^([0-9]{4})\-([A-Z0-9]{1,4})\-([A-Z]+)([0-9]+.*)$/;

            var topicIdentifier = syntax.exec(uniqueTopicCode);

            if (topicIdentifier !== null) {
                topicFactory.getTopicsAsync({
                    year: topicIdentifier[1],
                    semester: topicIdentifier[2],
                    subjectArea: topicIdentifier[3],
                    topicNumber: topicIdentifier[4]
                }, function (topics, status, headers, config) {
                    if (typeof topics[0] !== "undefined") {
                        callback(topics[0], status, headers, config);
                    }
                    else {
                        console.error("Could not load topic for identifier ", topicIdentifier);
                    }

                });
            }
        };

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
        topicFactory.getTopicTimetableAsync = function (topicId, callback) {
            var url = appConfig.apiPath + 'topics/' + topicId + '/classes.json';

            $http.get(url).success(function (classTypes, status, headers, config) {
                camelCaseService.camelCaseObject(classTypes);

                angular.forEach(classTypes, function (classType) {
                    classType.activeClassGroup = classType.classGroups[0];

                    angular.forEach(classType.classGroups, function (classGroup) {
                        sessionsService.sortSessions(classGroup.classSessions);
                        classGroup.locked = classType.classGroups.length === 1;
                    });
                });

                callback(classTypes, status, headers, config);
            });
        };
        topicFactory.loadTimetableForTopicAsync = function (topic, callback) {
            topicFactory.getTopicTimetableAsync(topic.id, function (classTypes, status, headers, config) {
                topic.classes = classTypes;

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

            booking.topicId = topic.id;
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
                if (chosenTopic.id === topic.id) {
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

            if (getTopicIndex(topic) === -1) {
                chosenTopics.push(topic);

                topicService.sortTopics(chosenTopics);

                if (broadcast) {
                    that.broadcastTopicsUpdate();
                }
            }
        };


        that.removeTopic = function (topic, broadcast) {
            if (broadcast === undefined) {
                broadcast = true;
            }

            var index = getTopicIndex(topic);

            if (index !== -1) {
                chosenTopics.splice(index, 1);
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

        clashService.sessionsClash = function (a, b) {
            if (a.dayOfWeek !== b.dayOfWeek) {
                return false;
            }
            else if (a.secondsStartsAt === b.secondsStartsAt) {
                return true;
            }
            // a's start is within b's interval
            else if (b.secondsStartsAt <= a.secondsStartsAt && a.secondsStartsAt < b.secondsEndsAt) {
                return true;
            }
            // a's end is within b's interval
            else if (b.secondsStartsAt < a.secondsEndsAt && a.secondsEndsAt <= b.secondsEndsAt) {
                return true;
            }
            // a wraps b
            else if (a.secondsStartsAt <= b.secondsStartsAt && b.secondsEndsAt <= a.secondsEndsAt) {
                return true;
            }
            // b wraps a
            else if (b.secondsStartsAt <= a.secondsStartsAt && a.secondsEndsAt <= b.secondsEndsAt) {
                return true;
            }
            else {
                return false;
            }
        };

        clashService.classGroupsClash = function (a, b) {
            var aIndex = 0;
            var bIndex = 0;

            // Assumption: a.classSessions and b.classSessions are sorted
            while (aIndex < a.classSessions.length && bIndex < b.classSessions.length) {
                //check if both session clash
                if (clashService.sessionsClash(a.classSessions[aIndex], b.classSessions[bIndex])) {
                    //there is a clash
                    return true;
                } else {
                    // Advance the pointer to whichever class group starts first
                    if (sessionsService.compareSessions(a.classSessions[aIndex], b.classSessions[bIndex]) < 0) {
                        aIndex++;
                    }
                    else {
                        bIndex++;
                    }
                }
            }

            // No clashes were found
            return false;
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

    .controller('TopicController', function ($scope, chosenTopicService, topicFactory, urlFactory) {
        $scope.years = appConfig.years;
        $scope.activeYear = appConfig.defaultYear;

        $scope.semesters = appConfig.semesters;
        $scope.activeSemester = appConfig.defaultSemester;

        $scope.selectedTopics = [];

        $scope.topicSearch = "";

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


        var selectedTopicIds = function () {
            var ids = [];

            angular.forEach($scope.selectedTopics, function (topic) {
                ids.push(topic.id);
            });

            return ids;
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
                        console.log(topic.code);
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
            urlFactory.set('semester', $scope.activeSemester);
            urlFactory.set('year', $scope.activeYear);
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
            return selectedTopicIds().indexOf(parseInt(topicId, 10)) !== -1;
        };

        $scope.validateTopic = function (topic) {
            if (typeof topic === "undefined") {
                return false;
            }
            else if (topicIdIsSelected(topic.id)) {
                return false;
            }

            return !$scope.formDisabled;
        };

        $scope.addTopic = function (topic) {
            if (!$scope.validateTopic(topic)) {
                return;
            }

            $scope.topicSearch = "";

            topic = angular.copy(topic);

            $scope.selectedTopics.push(topic);

            topicFactory.loadTimetableForTopicAsync(topic, function () {
                if (topicIdIsSelected(topic.id)) {
                    chosenTopicService.addTopic(topic);
                }
            });
        };

        $scope.removeTopic = function (topic) {
            var index = $scope.selectedTopics.indexOf(topic);
            $scope.selectedTopics.splice(index, 1);

            chosenTopicService.removeTopic(topic);
        };


        var loadFromUrl = function () {
            if (urlFactory.get('year') !== undefined && $scope.years.indexOf(urlFactory.get('year')) !== -1) {
                $scope.activeYear = urlFactory.get('year');
            }
            else {
                urlFactory.set('year', $scope.activeYear);
            }

            if (urlFactory.get('semester') !== undefined && $scope.semesters.indexOf(urlFactory.get('semester')) !== -1) {
                $scope.activeSemester = urlFactory.get('semester');
            }
            else {
                urlFactory.set('semester', $scope.activeSemester);
            }


            var topicIdentifiers = urlFactory.get('topics');
            if (typeof topicIdentifiers !== "undefined") {
                angular.forEach(topicIdentifiers, function (topicString) {
                    topicFactory.getTopicByUniqueTopicCodeAsync(topicString, function (topic) {
                        $scope.addTopic(topic);
                    });
                });
            }

            $scope.numTimetableCombinations = 1;
        };


        $scope.updateAvailableTopics();
        loadFromUrl();
    })

    .controller('ManualClassChooserController', function ($scope, chosenTopicService) {
        $scope.broadcastClassesUpdate = chosenTopicService.broadcastClassesUpdate;
        $scope.chosenTopics = chosenTopicService.getTopics();
    })

    .controller('TimetableController', function ($scope, chosenTopicService, topicFactory, timetableFactory, sessionsService, dayService, topicService, clashService, clashGroupFactory, urlFactory) {
        $scope.chosenTopics = [];
        $scope.days = dayService.days();
        $scope.hours = ["8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM"];
        $scope.timetable = timetableFactory.createEmptyTimetable();


        $scope.updateTimetable = function () {
            var timetable = timetableFactory.createEmptyTimetable();

            var bookings = topicService.listBookingsForTopics($scope.chosenTopics);
            bookings = sessionsService.sortSessions(bookings);

            angular.forEach(bookings, function (booking) {
                var day = booking.dayOfWeek;

                var clashGroups = timetable[day];
                var clashGroup = clashGroups[clashGroups.length - 1];

                if (typeof clashGroup === "undefined" || !clashService.sessionsClash(clashGroup, booking)) {
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

            var groupsClash = {};
            angular.forEach(allClassGroups, function (a) {
                groupsClash[a.id] = {};

                angular.forEach(allClassGroups, function (b) {
                    if (a !== b) {
                        groupsClash[a.id][b.id] = clashService.classGroupsClash(a, b);
                    }
                });
            });

            $scope.clashLimit = 9001; // It's over nine thousaaaaaaaaaaaaaand!

            var generatedTimetables = [];

            var examineTimetable = function (classGroupSelections, numClashes) {
                if (numClashes < $scope.clashLimit) {
                    $scope.clashLimit = numClashes;
                    generatedTimetables = [];
                }

                if (numClashes <= $scope.clashLimit) {
                    generatedTimetables.push(angular.extend({}, classGroupSelections));
                }
            };


            var searchTimetables = function (previouslyChosenClassGroups, remainingClassChoices, currentClashes) {
                var currentClassType = remainingClassChoices.pop();

                angular.forEach(currentClassType.classGroups, function (currentGroup) {
                    var selectionClashes = currentClashes;

                    angular.forEach(previouslyChosenClassGroups, function (previouslyChosenGroup) {
                        if (groupsClash[currentGroup.id][previouslyChosenGroup.classGroup.id]) {
                            selectionClashes++;
                        }
                    });

                    // Make sure we're not exceeding our clash limit
                    if (selectionClashes <= $scope.clashLimit) {
                        // Work with this group for now
                        previouslyChosenClassGroups[currentGroup.id] = newClassGroupSelection(currentClassType, currentGroup);

                        if (remainingClassChoices.length === 0) {
                            // No more choices we can make, check if this timetable is good and move on
                            examineTimetable(previouslyChosenClassGroups, selectionClashes);
                        } else {
                            // Keep making choices until we find a working timetable
                            searchTimetables(previouslyChosenClassGroups, remainingClassChoices, selectionClashes);
                        }

                        // Stop working with the current group
                        delete(previouslyChosenClassGroups[currentGroup.id]);
                    }
                });

                remainingClassChoices.push(currentClassType);
            };

            var chosenClassGroups = {};
            var remainingClassChoices = [];

            var classTypes = topicService.listClassTypesForTopics(topics);

            angular.forEach(classTypes, function (classType) {
                if (classType.classGroups.length >= 1 && classType.activeClassGroup.locked) {
                    var classGroup = classType.classGroups[0];
                    chosenClassGroups[classGroup.id] = newClassGroupSelection(classType, classGroup);
                }
                else if (classType.classGroups.length > 1) {
                    remainingClassChoices.push(classType);
                }
            });


            var startMillis = new Date().getTime();

            searchTimetables(chosenClassGroups, remainingClassChoices, 0);

            $scope.examineDuration = (new Date().getTime() - startMillis) / 1000;

            $scope.numRefinedPossibleTimetables = generatedTimetables.length;

            return generatedTimetables;
        };

        var cherryPickIdealTimetables = function (rawGeneratedTimetables) {

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

                // TODO: Share code with toTime filter
                var duration = moment.duration(timetable.secondsAtUni * 1000);
                timetable.hoursAtUni = Math.floor(duration.asHours()) + ":" + Math.floor(duration.asMinutes() % 60);

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

            timetables.sort(function (a, b) {
                var daysDifference = a.daysAtUni - b.daysAtUni;

                if (daysDifference !== 0) {
                    return daysDifference;
                }

                var secondsDifference = a.secondsAtUni - b.secondsAtUni;

                return secondsDifference;
            });

            return timetables;
        };

        $scope.generateTimetables = function () {
            var timetables = findTimetablesWithMinimumClashes(chosenTopics);

            timetables = cherryPickIdealTimetables(timetables);

            $scope.topTimetableCandidates = timetables.slice(0, 5);

            $scope.hasGeneratedTimetables = true;
        };


        $scope.$on('chosenTopicsUpdate', function () {
            chosenTopics = chosenTopicService.getTopics();
            $scope.hasChosenTopics = (chosenTopics.length > 0);

            $scope.possibleTimetables = countPossibleTimetables(chosenTopics);

            $scope.hasGeneratedTimetables = false;
        });
    })
;

