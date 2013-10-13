var appConfig = {
    apiPath: "http://flindersapi.tobias.pw/api/v1/",
    years: [2013],
    defaultYear: 2013,
    semesters: ["S1", "NS1", "S2", "NS2"],
    defaultSemester: "S2"
};

var app = angular.module('timetable', []);

app.filter('toTime', function() {return function(number) {
    number = number - (10.5 * 3600);
    return moment.unix(number).format('h:mm a');
}});

app.factory('topicFactory', function ($http, sessionsService) {
    var topicFactory = {};

    topicFactory.getTopicsAsync = function (year, semester, callback) {
        var url = appConfig.apiPath + 'topics.json' + "?";

        if (year !== "Any")
            url += "&year=" + year;
        if (semester !== "Any")
            url += "&semester=" + semester;

        $http.get(url).success(function (data, status, headers, config) {
            function compareTopics(a, b) {
                var subject_difference = a.subject_area.localeCompare(b.subject_area);

                if (subject_difference !== 0) {
                    return subject_difference;
                }

                var topic_difference = a.topic_number.localeCompare(b.topic_number);

                if (topic_difference !== 0) {
                    return topic_difference;
                }

                return a.name.localeCompare(b.name);
            }

            data.sort(compareTopics);

            callback(data, status, headers, config);
        });
    };

    topicFactory.getTopicAsync = function (topic_id, callback) {
        var url = appConfig.apiPath + 'topics/' + topic_id + '.json';

        $http.get(url).success(function (data, status, headers, config) {
            callback(data, status, headers, config);
        });
    };
    topicFactory.getTopicTimetableAsync = function (topic_id, callback) {
        var url = appConfig.apiPath + 'topics/' + topic_id + '/classes.json';

        $http.get(url).success(function (class_types, status, headers, config) {
            angular.forEach(class_types, function (class_type) {
                class_type.active_class_group = class_type.class_groups[0];

                angular.forEach(class_type.class_groups, function (class_group) {
                    class_group.class_sessions = sessionsService.sortSessions(class_group.class_sessions);
                    class_group.locked = class_type.class_groups.length === 1;
                });
            });

            callback(class_types, status, headers, config);
        });
    };
    topicFactory.loadTimetableForTopicAsync = function (topic, callback) {
        topicFactory.getTopicTimetableAsync(topic.id, function (class_types, status, headers, config) {
            topic.classes = class_types;

            callback(topic, status, headers, config)
        });
    };

    return topicFactory;
});

app.factory('topicService', function (bookingFactory) {
    var that = {};

    that.listBookingsForTopics = function (topics) {
        var bookings = [];

        angular.forEach(topics, function (topic) {
            angular.forEach(topic.classes, function (class_type) {
                if (!class_type.active_class_group) {
                    return;
                }
                angular.forEach(class_type.active_class_group.class_sessions, function (class_session) {
                    bookings.push(bookingFactory.newBooking(topic, class_type, class_type.active_class_group, class_session));
                });
            });
        });

        return bookings;
    };

    that.listClassTypesForTopics = function (topics) {
        var class_types = [];

        angular.forEach(topics, function (topic) {
            if (topic.classes)
                class_types = class_types.concat(topic.classes);
        });

        return class_types;
    };

    that.listClassGroupsForTopics = function (topics) {
        var class_types = that.listClassTypesForTopics(topics);

        var class_groups = [];

        angular.forEach(class_types, function (class_type) {
            if (class_type.class_groups)
                class_groups = class_groups.concat(class_type.class_groups);
        });

        return class_groups;
    };

    return that;
});

app.factory('timetableFactory', function (dayService) {
    var that = {};

    that.createEmptyTimetable = function () {
        var timetable = {};

        angular.forEach(dayService.days(), function (day) {
            timetable[day] = [];
        });

        return timetable;
    };

    return that;
});

app.factory('bookingFactory', function () {
    var that = {};

    that.newBooking = function (topic, class_type, class_group, class_session) {
        var booking = {};

        booking.topic_id = topic.id;
        booking.topic_code = topic.code;
        booking.class_name = class_type.name;
        booking.day_of_week = class_session.day_of_week;
        booking.seconds_starts_at = class_session.seconds_starts_at;
        booking.seconds_ends_at = class_session.seconds_ends_at;
        booking.seconds_duration = class_session.seconds_duration;
        booking.locked = class_group.locked;

        return booking;
    };

    return that;
});

app.factory('clashGroupFactory', function () {
    var that = {};

    that.newClashGroup = function (firstBooking) {
        var clashGroup = {
            day_of_week: firstBooking.day_of_week,
            seconds_starts_at: firstBooking.seconds_starts_at,
            seconds_ends_at: firstBooking.seconds_ends_at,

            clashColumns: [],

            addBooking: function (booking) {
                clashGroup.seconds_starts_at = Math.min(clashGroup.seconds_starts_at, booking.seconds_starts_at);
                clashGroup.seconds_ends_at = Math.max(clashGroup.seconds_ends_at, booking.seconds_ends_at);


                var clash_column = null;
                if (clashGroup.clashColumns.length > 0) {
                    var latest_contestant_ends = 0;
                    angular.forEach(clashGroup.clashColumns, function (contestant_column) {
                        var contestant_column_ends = contestant_column[contestant_column.length - 1].seconds_ends_at;
                        if (contestant_column_ends <= booking.seconds_starts_at && contestant_column_ends > latest_contestant_ends) {
                            clash_column = contestant_column;
                            latest_contestant_ends = contestant_column_ends;
                        }
                    });
                }

                if (clash_column === null) {
                    clash_column = [];
                    clashGroup.clashColumns.push(clash_column);
                }

                clash_column.push(booking);

                return true;
            }
        };

        clashGroup.addBooking(firstBooking);

        return clashGroup;
    };

    return that;
});

app.factory('chosenTopicService', function ($rootScope) {
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

    that.addTopic = function (topic) {
        if (getTopicIndex(topic) === -1) {
            chosenTopics.push(topic);
            that.broadcastTopicsUpdate();
        }
    };


    that.removeTopic = function (topic) {
        var index = getTopicIndex(topic);

        if (index !== -1) {
            chosenTopics.splice(index, 1);
            that.broadcastTopicsUpdate();
        }
    };

    that.getTopics = function () {
        return chosenTopics;
    };

    return that;
});

app.factory('sessionsService', function (dayService) {
    var that = {};

    that.compareSessions = function (a, b) {
        // Sort by day
        var daysDifference = dayService.compareDays(a.day_of_week, b.day_of_week);
        if (daysDifference !== 0)
            return daysDifference;

        // Sort by starting time of day
        var secondsStartsDifference = a.seconds_starts_at - b.seconds_starts_at;
        if (secondsStartsDifference !== 0)
            return secondsStartsDifference;


        return a.seconds_ends_at - b.seconds_ends_at;
    };

    that.sortSessions = function (sessions) {
        return sessions.sort(that.compareSessions);
    };

    return that;
});

app.factory('clashService', function (sessionsService) {
    var that = {};

    that.sessionsClash = function (a, b) {
        if (a.day_of_week !== b.day_of_week)
            return false;

        else if (a.seconds_starts_at == b.seconds_starts_at)
            return true;

        // a's start is within b's interval
        else if (b.seconds_starts_at <= a.seconds_starts_at && a.seconds_starts_at < b.seconds_ends_at)
            return true;

        // a's end is within b's interval
        else if (b.seconds_starts_at < a.seconds_ends_at && a.seconds_ends_at <= b.seconds_ends_at)
            return true;

        // a wraps b
        else if (a.seconds_starts_at <= b.seconds_starts_at && b.seconds_ends_at <= a.seconds_ends_at)
            return true;

        // b wraps a
        else if (b.seconds_starts_at <= a.seconds_starts_at && a.seconds_ends_at <= b.seconds_ends_at)
            return true;


        return false;
    };

    that.classGroupsClash = function (a, b) {
        var aIndex = 0;
        var bIndex = 0;

        // Assumption: a.class_sessions and b.class_sessions are sorted
        while (aIndex < a.class_sessions.length && bIndex < b.class_sessions.length) {
            //check if both session clash
            if (that.sessionsClash(a.class_sessions[aIndex], b.class_sessions[bIndex])) {
                //there is a clash
                return true;
            } else {
                // Advance the pointer to whichever class group starts first
                if (sessionsService.compareSessions(a.class_sessions[aIndex], b.class_sessions[bIndex]) < 0)
                    aIndex++;
                else
                    bIndex++;
            }
        }

        // No clashes were found
        return false;
    };

    return that;
});

app.factory('dayService', function () {
    var that = {};

    var dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    var dayIndexes = {};

    angular.forEach(dayNames, function (name, index) {
        dayIndexes[name] = index;
    });

    that.dayNameToDayOfWeek = function (dayName) {
        return dayNames[dayName];
    };

    that.dayOfWeekToDayName = function (dayOfWeek) {
        return days[dayOfWeek]
    };

    that.days = function () {
        // Copy the array so malicious Russells can't manipulate our internal one
        return dayNames.slice(0);
    };

    that.compareDays = function (a, b) {
        return that.dayNameToDayOfWeek(a) - that.dayNameToDayOfWeek(b);
    };

    return that;
});

app.controller('TopicController', function ($scope, chosenTopicService, topicFactory, filterFilter) {
    $scope.years = appConfig.years;
    $scope.activeYear = appConfig.defaultYear;

    $scope.semesters = appConfig.semesters;
    $scope.activeSemester = appConfig.defaultSemester;

    $scope.formDisabled = false;

    $scope.selectedTopics = [];

    $scope.numTimetableCombinations = 1;

    var selectedTopicIds = function () {
        var ids = [];

        angular.forEach($scope.selectedTopics, function (topic) {
            ids.push(topic.id);
        });

        return ids;
    };

    var applyTopicSearchFilter = function (newValue) {
        var filteredArray = filterFilter($scope.topicIndex, newValue);

        if (filteredArray && filteredArray.indexOf($scope.activeTopic) !== -1) {
            // Keep the currently selected topic selected if it's relevant
        }
        else if (filteredArray && filteredArray.length) {
            // Select the first topic
            $scope.activeTopic = filteredArray[0];
        }
    };

    var topicIdIsSelected = function (topicId) {
        return selectedTopicIds().indexOf(parseInt(topicId)) !== -1;
    };

    $scope.loadTopicIndex = function () {
        $scope.topicIndex = [];

        topicFactory.getTopicsAsync($scope.activeYear, $scope.activeSemester, function (data) {
            $scope.topicIndex = data;
            applyTopicSearchFilter($scope.topicSearch);
        });
    };

    $scope.$watch('topicSearch', function (newValue) {
        applyTopicSearchFilter(newValue);
    });

    $scope.validateTopic = function (topic) {
        if (typeof topic === "undefined")
            return false;

        if (topicIdIsSelected(topic.id))
            return false;

        return !$scope.formDisabled;
    };

    $scope.addTopic = function (topic) {
        if (!$scope.validateTopic(topic))
            return;

        $scope.topicSearch = "";

        topic = angular.copy(topic);

        $scope.selectedTopics.push($scope.activeTopic);


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

    $scope.loadTopicIndex();
});

app.controller('ManualClassChooserController', function ($scope, chosenTopicService) {
    $scope.broadcastClassesUpdate = chosenTopicService.broadcastClassesUpdate;
    $scope.chosenTopics = chosenTopicService.getTopics();
});

app.controller('TimetableController', function ($scope, chosenTopicService, topicFactory, timetableFactory, sessionsService, dayService, topicService, clashService, clashGroupFactory) {
    $scope.chosenTopics = [];
    $scope.days = dayService.days();
    $scope.hours = ["8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM"];
    $scope.timetable = timetableFactory.createEmptyTimetable();


    $scope.updateTimetable = function () {
        var timetable = timetableFactory.createEmptyTimetable();

        var bookings = topicService.listBookingsForTopics($scope.chosenTopics);
        bookings = sessionsService.sortSessions(bookings);

        angular.forEach(bookings, function (booking) {
            var day = booking.day_of_week;

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
});

app.controller('TimetableGeneratorController', function ($scope, chosenTopicService, topicService, clashService) {
    var chosenTopics = chosenTopicService.getTopics();

    var countPossibleTimetables = function (topics) {
        var possibleTimetables = 1;

        angular.forEach(topics, function (topic) {
            angular.forEach(topic.classes, function (class_type) {
                var groups = class_type.class_groups.length;
                if (groups > 0) {
                    possibleTimetables *= groups;
                }
            });
        });

        return possibleTimetables;
    };


    $scope.applyClassGroupSelection = function (classGroupSelection) {
        angular.forEach(classGroupSelection, function (entry) {
            entry.class_type.active_class_group = entry.class_group;
        });

        chosenTopicService.broadcastClassesUpdate();
    };

    var findTimetablesWithMinimumClashes = function (topics) {
        if (topics.length === 0) {
            return;
        }

        var newClassGroupSelection = function (class_type, class_group) {
            return {
                class_type: class_type,
                class_group: class_group
            }
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

        var examineTimetable = function (class_group_selections, numClashes) {
            if (numClashes < $scope.clashLimit) {
                $scope.clashLimit = numClashes;
                generatedTimetables = [];
            }

            if (numClashes <= $scope.clashLimit) {
                generatedTimetables.push(angular.extend({}, class_group_selections));
            }
        };


        var searchTimetables = function (previouslyChosenClassGroups, remainingClassChoices, currentClashes) {
            var currentClassType = remainingClassChoices.pop();

            angular.forEach(currentClassType.class_groups, function (currentGroup) {
                var selectionClashes = currentClashes;

                angular.forEach(previouslyChosenClassGroups, function (previouslyChosenGroup) {
                    if (groupsClash[currentGroup.id][previouslyChosenGroup.class_group.id]) {
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

        var chosen_class_groups = {};
        var remaining_class_choices = [];

        var class_types = topicService.listClassTypesForTopics(topics);

        angular.forEach(class_types, function (class_type) {
            if (class_type.class_groups.length >= 1 && class_type.active_class_group.locked) {
                var class_group = class_type.class_groups[0];
                chosen_class_groups[class_group.id] = newClassGroupSelection(class_type, class_group);
            }
            else if (class_type.class_groups.length > 1) {
                remaining_class_choices.push(class_type);
            }
        });


        var startMillis = new Date().getTime();

        searchTimetables(chosen_class_groups, remaining_class_choices, 0);

        $scope.examineDuration = (new Date().getTime() - startMillis) / 1000;

        $scope.numRefinedPossibleTimetables = generatedTimetables.length;

        return generatedTimetables;
    };

    var cherryPickIdealTimetables = function (rawGeneratedTimetables) {

        var classSessionsForClassPicks = function (classPicks) {
            var classSessions = [];

            angular.forEach(classPicks, function (classPick) {
                classSessions = classSessions.concat(classPick.class_group.class_sessions);
            });

            return classSessions;
        };

        var calculateTimeMetrics = function (timetable) {
            var days = { };

            angular.forEach(timetable.class_sessions, function (session) {
                if (typeof days[session.day_of_week] === "undefined") {
                    days[session.day_of_week] = {
                        seconds_starts_at: session.seconds_starts_at,
                        seconds_ends_at: session.seconds_ends_at
                    }
                }
                else {
                    days[session.day_of_week].seconds_starts_at = Math.min(days[session.day_of_week].seconds_starts_at, session.seconds_starts_at);
                    days[session.day_of_week].seconds_ends_at = Math.max(days[session.day_of_week].seconds_ends_at, session.seconds_ends_at)
                }
            });

            timetable.daysAtUni = 0;
            timetable.secondsAtUni = 0;

            var startTimeSum = 0;
            var endTimeSum = 0;

            angular.forEach(days, function (day) {
                timetable.daysAtUni++;
                timetable.secondsAtUni += (day.seconds_ends_at - day.seconds_starts_at);

                startTimeSum += day.seconds_starts_at;
                endTimeSum += day.seconds_ends_at;
            });

            timetable.averageStartTime = startTimeSum / timetable.daysAtUni;
            timetable.averageEndTime = endTimeSum / timetable.daysAtUni;


            var duration = moment.duration(timetable.secondsAtUni * 1000);
            timetable.hoursAtUni = Math.floor(duration.asHours()) + ":" + Math.floor(duration.asMinutes() % 60);

            return timetable;
        };

        var timetables = [];

        // Wrap each timetable and calculate statistics and stuff
        angular.forEach(rawGeneratedTimetables, function (generatedTimetable) {
            var timetable = {};

            timetable.classPicks = generatedTimetable;
            timetable.class_sessions = classSessionsForClassPicks(generatedTimetable);

            calculateTimeMetrics(timetable);

            timetables.push(timetable)
        });

        timetables.sort(function (a, b) {
            var daysDifference = a.daysAtUni - b.daysAtUni;

            if (daysDifference !== 0) {
                return daysDifference;
            }

            var secondsDifference = a.secondsAtUni - b.secondsAtUni;

            return a.secondsAtUni - b.secondsAtUni;
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
});