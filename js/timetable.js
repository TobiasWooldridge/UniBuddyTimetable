function timetable(userConfig) {
    var config = {
        api_path: "http://flindersapi.tobias.pw/api/v1/"
    };

    for (var key in userConfig) {
        if (userConfig.hasOwnProperty(key)) {
            config[key] = userConfig[key];
        }
    }

    // Hard-coding this for now #YOLO
    var days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    var hours = ["8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM"];

    var dayNameToDayOfWeek = function (dayName) {
        if (typeof dayNameToDayOfWeek.hash === "undefined") {
            dayNameToDayOfWeek.hash = {}

            angular.forEach(days, function (name, index) {
                dayNameToDayOfWeek.hash[name] = index;
            });
        }

        return dayNameToDayOfWeek.hash[dayName];
    }
    var dayOfWeekToDayName = function (dayOfWeek) {
        return days[dayOfWeek]
    }


    var sessionsClash = function (a, b) {
        var outcome = false;

        if (a.day_of_week !== b.day_of_week) {
            outcome = false;
        }

        else if (a.seconds_starts_at == b.seconds_starts_at) {
            outcome = true;
        }

        // a's start is within b's interval
        else if (b.seconds_starts_at <= a.seconds_starts_at && a.seconds_starts_at < b.seconds_ends_at) {
            outcome = true;
        }

        // a's end is within b's interval
        else if (b.seconds_starts_at < a.seconds_ends_at && a.seconds_ends_at <= b.seconds_ends_at) {
            outcome = true;
        }

        // a wraps b
        else if (a.seconds_starts_at <= b.seconds_starts_at && b.seconds_ends_at <= a.seconds_ends_at) {
            outcome = true;
        }

        // b wraps a
        else if (b.seconds_starts_at <= a.seconds_starts_at && a.seconds_ends_at <= b.seconds_ends_at) {
            outcome = true;
        }

        return outcome;
    }


    var classGroupsClash = function (a, b) {
        //start with the first class session for each
        aindex = 0;
        bindex = 0;
        while (aindex < a.class_sessions.length && bindex < b.class_sessions.length) {
            //check if both session clash
            if (sessionsClash(a.class_sessions[aindex], b.class_sessions[bindex])) {
                //there is a clash
                return true;
            } else {
                //there is no clash find out which starts first
                if (compareSessions(a.class_sessions[aindex], b.class_sessions[bindex]) < 0) {
                    //a is before b, advance a
                    aindex++;
                } else {
                    //b is before a, advance b
                    bindex++;
                }
            }
        }
        //iterated through all of 1 group without clashing with the other group
        return false;
    }

    var newBooking = function (topic, class_type, class_group, class_session) {
        var booking = {
            topic_id: topic.id,
            topic_code: topic.code,
            class_name: class_type.name,
            day_of_week: class_session.day_of_week,
            seconds_starts_at: class_session.seconds_starts_at,
            seconds_ends_at: class_session.seconds_ends_at,
            seconds_duration: class_session.seconds_duration,
            locked: class_type.class_groups.length === 1
        };

        return booking;
    }

    var listBookingsForTopics = function (topics) {
        var bookings = [];

        angular.forEach(topics, function (topic) {
            angular.forEach(topic.classes, function (class_type) {
                if (!class_type.active_class_group) {
                    return;
                }
                angular.forEach(class_type.active_class_group.class_sessions, function (class_session) {
                    bookings.push(newBooking(topic, class_type, class_type.active_class_group, class_session));
                });
            });
        });

        return bookings;
    }

    var listClassTypesForTopics = function (topics) {
        var class_types = [];

        angular.forEach(topics, function (topic) {
            if (topic.classes)
                class_types = class_types.concat(topic.classes);
        });

        return class_types;
    }

    var listClassGroupsForTopics = function (topics) {
        var class_types = listClassTypesForTopics(topics);

        var class_groups = [];

        angular.forEach(class_types, function (class_type) {
            if (class_type.class_groups)
                class_groups = class_groups.concat(class_type.class_groups);
        });

        return class_groups;
    }

    var compareSessions = function (a, b) {
        // Sort by day
        var daysDifference = dayNameToDayOfWeek(a.day_of_week) - dayNameToDayOfWeek(b.day_of_week);
        if (daysDifference !== 0)
            return daysDifference;

        // Sort by starting time of day
        var secondsDifference = a.seconds_starts_at - b.seconds_starts_at;
        if (secondsDifference !== 0)
            return secondsDifference;

        return a.seconds_ends_at - b.seconds_ends_at;
    }

    var sortSessions = function (sessions) {
        return sessions.sort(compareSessions);
    }

    var newClashGroup = function (firstBooking) {
        var clashGroup = {
            day_of_week: firstBooking.day_of_week,
            seconds_starts_at: firstBooking.seconds_starts_at,
            seconds_ends_at: firstBooking.seconds_ends_at,

            clash_columns: [],

            addBooking: function (booking) {
                clashGroup.seconds_starts_at = Math.min(clashGroup.seconds_starts_at, booking.seconds_starts_at);
                clashGroup.seconds_ends_at = Math.max(clashGroup.seconds_ends_at, booking.seconds_ends_at);


                var clash_column = null;
                if (clashGroup.clash_columns.length > 0) {
                    var latest_contestant_ends = 0;
                    angular.forEach(clashGroup.clash_columns, function (contestant_column) {
                        var contestant_column_ends = contestant_column[contestant_column.length - 1].seconds_ends_at;
                        if (contestant_column_ends <= booking.seconds_starts_at && contestant_column_ends > latest_contestant_ends) {
                            clash_column = contestant_column;
                            latest_contestant_ends = contestant_column_ends;
                        }
                    });
                }

                if (clash_column === null) {
                    clash_column = [];
                    clashGroup.clash_columns.push(clash_column);
                }

                clash_column.push(booking);

                return true;
            }
        };

        clashGroup.addBooking(firstBooking);

        return clashGroup;
    };


    var app = angular.module('timetable', []);

    app.factory('topicFactory', function ($http) {
        var topicFactory = {
            getTopicsAsync: function (year, semester, callback) {
                var url = config.api_path + 'topics.json' + "?"

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
            },
            getTopicAsync: function (topic_id, callback) {
                var url = config.api_path + 'topics/' + topic_id + '.json';

                $http.get(url).success(function (data, status, headers, config) {
                    callback(data, status, headers, config);
                });
            },
            getTopicTimetableAsync: function (topic_id, callback) {
                var url = config.api_path + 'topics/' + topic_id + '/classes.json';

                $http.get(url).success(function (class_types, status, headers, config) {
                    angular.forEach(class_types, function (class_type) {
                        class_type.active_class_group = class_type.class_groups[0];

                        angular.forEach(class_type.class_groups, function (class_group) {
                            class_group.class_sessions = sortSessions(class_group.class_sessions);
                        });
                    });

                    callback(class_types, status, headers, config);
                });
            },
            loadTimetableForTopicAsync: function (topic, callback) {
                topicFactory.getTopicTimetableAsync(topic.id, function (class_types, status, headers, config) {
                    topic.classes = class_types;

                    callback(topic, status, headers, config)
                });
            }
        };

        return topicFactory;
    });

    app.factory('timetableFactory', function ($http) {
        return {
            createEmptyTimetable: function () {
                timetable = {};

                angular.forEach(days, function (day) {
                    timetable[day] = [];
                });

                return timetable;
            }
        }
    });

    app.factory('topicService', function ($rootScope) {
        var topicService = {};

        topicService.chosenTopics = [];

        topicService.broadcast = function () {
            $rootScope.$broadcast('chosenTopicsUpdate');
        }


        return topicService;
    });

    app.controller('TopicController', function ($scope, topicService, topicFactory, filterFilter) {
        $scope.years = [2013];
        $scope.activeYear = $scope.years[0];

        $scope.semesters = ["S1", "NS1", "S2", "NS2"];
        $scope.activeSemester = $scope.semesters[2];

        $scope.formDisabled = false;

        $scope.selectedTopics = [];

        $scope.possibleTimetables = 1;

        var selectedTopicIds = function () {
            var ids = [];

            angular.forEach($scope.selectedTopics, function (topic) {
                ids.push(topic.id);
            });

            return ids;
        }

        var applyTopicSearchFilter = function (newValue) {
            var filteredArray = filterFilter($scope.topicIndex, newValue);

            if (filteredArray && filteredArray.indexOf($scope.activeTopic) !== -1) {
                // Keep the currently selected topic selected if it's relevant
            }
            else if (filteredArray && filteredArray.length) {
                // Select the first topic
                $scope.activeTopic = filteredArray[0];
            }
        }

        var topicIdIsSelected = function (topicId) {
            return selectedTopicIds().indexOf(parseInt(topicId)) !== -1;
        };

        $scope.loadTopicIndex = function () {
            $scope.topicIndex = [];

            topicFactory.getTopicsAsync($scope.activeYear, $scope.activeSemester, function (data) {
                $scope.topicIndex = data;
                applyTopicSearchFilter($scope.topicSearch);
            });
        }

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

            topic = angular.copy(topic);

            $scope.selectedTopics.push($scope.activeTopic);

            topicService.chosenTopics.push(topic);

            topicFactory.loadTimetableForTopicAsync(topic, function () {
                if (!topicIdIsSelected(topic.id))
                    return false;

                topicService.broadcast();
            });

            $scope.topicSearch = "";
        }

        $scope.removeTopic = function (topic) {
            var index = $scope.selectedTopics.indexOf(topic)
            $scope.selectedTopics.splice(index, 1);


            index = -1;
            angular.forEach(topicService.chosenTopics, function (chosenTopic, i) {
                if (chosenTopic.id === topic.id) {
                    index = i;
                    return false;
                }
            });

            if (index !== -1) {
                topicService.chosenTopics.splice(index, 1);
                topicService.broadcast()
            }
        }

        $scope.loadTopicIndex();
    });


    app.controller('TimetableController', function ($scope, topicService, topicFactory, timetableFactory) {
        $scope.chosenTopics = []
        $scope.days = days;
        $scope.hours = hours;
        $scope.timetable = timetableFactory.createEmptyTimetable();

        var updatePossibleTimetables = function () {
            var possibleTimetables = 1;

            angular.forEach($scope.chosenTopics, function (topic) {
                angular.forEach(topic.classes, function (class_type) {
                    var groups = class_type.class_groups.length;
                    if (groups > 0) {
                        possibleTimetables *= groups;
                    }
                });
            });

            $scope.possibleTimetables = possibleTimetables;
        };

        $scope.bruteForcePossibleTimetables = function () {
            var newClassGroupSelection = function (class_type, class_group) {
                return {
                    class_type: class_type,
                    class_group: class_group
                }
            }
            var shallowCopyClassGroupSelections = function (classGroupSelections) {
                var selections = []

                angular.forEach(classGroupSelections, function(selection) {
                    selections.push(selection);
                })

                return selections;
            }

            $scope.applyClassGroupSelection = function(classGroupSelection) {
                console.log(classGroupSelection);
                angular.forEach(classGroupSelection, function(entry) {
                   entry.class_type.active_class_group = entry.class_group;
                });

                $scope.updateTimetable();
            }


            var all_class_groups = listClassGroupsForTopics($scope.chosenTopics);

            var group_clashes = {};
            angular.forEach(all_class_groups, function (a) {
                group_clashes[a.id] = {};

                angular.forEach(all_class_groups, function (b) {
                    if (a !== b) {
                        group_clashes[a.id][b.id] = classGroupsClash(a, b);
                    }
                });
            });


            var max_clashes = 1337;

            $scope.timetablePossibilities = [];

            var examineTimetable = function (class_group_selections) {
                examinedTimetables++;
                $scope.timetablePossibilities.push(shallowCopyClassGroupSelections(class_group_selections))
            }



            var searchTimetables = function (chosen_class_groups, remaining_class_choices, current_clashes) {
                if (typeof current_clashes === "undefined") {
                    current_clashes = 0;
                }


                var currentClassType = remaining_class_choices.pop();


                angular.forEach(currentClassType.class_groups, function (group) {
                    // Test that the new addition clashes with nobody
                    var foundClashes = false;

                    angular.forEach(chosen_class_groups, function (chosen_class_group) {
                        if (group_clashes[group.id][chosen_class_group.class_group.id]) {
                            foundClashes = true;
                            return false;
                        }
                    })

                    if (foundClashes) {
                        return;
                    }

                    // Work with this group for now
                    chosen_class_groups[group.id] = newClassGroupSelection(currentClassType, group);

                    if (remaining_class_choices.length === 0) {
                        // No more choices we can make, check if this timetable is good and move on
                        examineTimetable(chosen_class_groups);
                    } else {
                        // Keep making choices until we find a working timetable
                        searchTimetables(chosen_class_groups, remaining_class_choices);
                    }

                    // Stop working with the current group
                    delete(chosen_class_groups[group.id]);
                });

                remaining_class_choices.push(currentClassType);
            }

            var chosen_class_groups = {};
            var remaining_class_choices = [];

            var class_types = listClassTypesForTopics($scope.chosenTopics);

            angular.forEach(class_types, function (class_type) {
                if (class_type.class_groups.length > 1) {
                    remaining_class_choices.push(class_type);
                }
                else if (class_type.class_groups.length === 1) {
                    var class_group = class_type.class_groups[0];
                    chosen_class_groups[class_group.id] = newClassGroupSelection(class_type, class_group);
                }
            });

            var examinedTimetables = 0;

            var startMillis = new Date().getTime();

            searchTimetables(chosen_class_groups, remaining_class_choices);

            $scope.examineDuration = (new Date().getTime() - startMillis) / 1000;

            $scope.examinedTimetables = examinedTimetables;
        }

        $scope.updateTimetable = function () {
            var timetable = timetableFactory.createEmptyTimetable();

            var bookings = listBookingsForTopics($scope.chosenTopics);
            bookings = sortSessions(bookings);

            angular.forEach(bookings, function (booking) {
                var day = booking.day_of_week;

                var clashGroups = timetable[day];
                var clashGroup = clashGroups[clashGroups.length - 1];

                if (typeof clashGroup === "undefined" || !sessionsClash(clashGroup, booking)) {
                    clashGroup = newClashGroup(booking);
                    timetable[day].push(clashGroup);
                }
                else {
                    clashGroup.addBooking(booking);
                }

            });

            $scope.timetable = timetable;

            updatePossibleTimetables();
        }

        $scope.chosenTopics = topicService.chosenTopics;

        $scope.$on('chosenTopicsUpdate', function () {
            $scope.updateTimetable();
            $scope.bruteForcePossibleTimetables();
        });
    })
}