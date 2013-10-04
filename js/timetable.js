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


    var app = angular.module('timetable', []);

    app.factory('topicFactory', function ($http) {
        return {
            getSubjectAreasAsync: function (callback) {
                $http.get(config.api_path + 'subjects').success(function (data, status, headers, config) {
                    mutilated_data = []

                    angular.forEach(data, function (value) {
                        mutilated_data.push(value.subject_area);
                    });

                    callback(mutilated_data, status, headers, config);
                });
            },
            getTopicsAsync: function (year, semester, callback) {
                var url = config.api_path + 'topics' + "?"

                if (year !== "Any")
                    url += "&year=" + year;
                if (semester !== "Any")
                    url += "&semester=" + semester;

                $http.get(url).success(function (data, status, headers, config) {
                    function compareTopics(a, b) {
                        var subject_difference = a.subject_area.localeCompare(b.subject_area);

                        if (subject_difference !== 0)
                            return subject_difference;

                        var topic_difference = a.topic_number.localeCompare(b.topic_number);

                        if (topic_difference !== 0)
                            return topic_difference;

                        return a.name.localeCompare(b.name);
                    }

                    data.sort(compareTopics);


                    callback(data, status, headers, config);
                });
            },
            getTopicAsync: function (topic_id, callback) {
                var url = config.api_path + 'topics/' + topic_id;


                $http.get(url).success(function (data, status, headers, config) {
                    callback(data, status, headers, config);
                });
            },
            getTopicTimetableAsync: function (topic_id, callback) {
                var url = config.api_path + 'topics/' + topic_id + '/classes';

                $http.get(url).success(function (data, status, headers, config) {
                    callback(data, status, headers, config);
                });
            }
        }
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



    app.controller('TimetableController', function ($scope, topicFactory, timetableFactory, filterFilter) {
        $scope.chosenTopics = []

        $scope.chosenTopicIds = function () {
            var ids = [];

            angular.forEach($scope.chosenTopics, function(topic) {
                ids.push(topic.id);
            });

            return ids;
        }

        var applyTopicSearchFilter = function(newValue) {
            filteredArray = filterFilter($scope.topics, newValue);

            if (typeof filteredArray !== "undefined" && filteredArray.indexOf($scope.activeTopic) !== -1) {
                // Keep the currently selected topic selected if it's relevant
            }
            else if (typeof filteredArray !== "undefined" && filteredArray.length) {
                // Select the first topic
                $scope.activeTopic = filteredArray[0];
            }
        }

        var topicAlreadySelected = function (topicId) {
            return $scope.chosenTopicIds().indexOf(parseInt(topicId)) !== -1;
        };

        var updatePossibleTimetables = function () {
            var possibleTimetables = 1;


            angular.forEach($scope.chosenTopics, function (topic) {
                angular.forEach(topic.classes, function (class_type) {
                    console.log(class_type);
                    var groups = class_type.class_groups.length;
                    if (groups > 0) {
                        possibleTimetables *= groups;
                        console.log(possibleTimetables, groups);
                    }
                });
            });

            console.log(possibleTimetables + " possible timetables");
            $scope.possibleTimetables = possibleTimetables;
        };

        $scope.validateTopic = function() {
            if (typeof $scope.activeTopic === "undefined") {
                return false;
            }

            if (topicAlreadySelected($scope.activeTopic.id)) {
                return false;
            }

            return true;
        };

        $scope.updateTopics = function () {
            $scope.topics = [];

            topicFactory.getTopicsAsync($scope.activeYear, $scope.activeSemester, function (data) {
                $scope.topics = data;
                applyTopicSearchFilter($scope.topicSearch);
            });
        }

        $scope.addTopic = function () {
            if (!$scope.validateTopic()) {
                return;
            }

            topicId = $scope.activeTopic.id;

            topicFactory.getTopicAsync(topicId, function (topic) {
                $scope.chosenTopics.push(topic);

                topicFactory.getTopicTimetableAsync(topicId, function (class_types) {
                    angular.forEach(class_types, function(class_type) {
                        class_type.active_class_group = class_type.class_groups[0];
                    });

                    topic.classes = class_types;

                    $scope.updateTimetable();
                });
            });
        }

        $scope.removeTopic = function (topic) {
            var index = $scope.chosenTopics.indexOf(topic)
            $scope.chosenTopics.splice(index, 1);

            $scope.updateTimetable();
        }
        $scope.$watch('topicSearch',function(newValue){
            applyTopicSearchFilter(newValue);
        });

        var sessionsClash = function (a, b) {
            var outcome = false;

            // a's start is within b's interval
            if (b.seconds_starts_at <= a.seconds_starts_at && a.seconds_starts_at < b.seconds_ends_at) {
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

            console.log(a.seconds_starts_at, a.seconds_ends_at, b.seconds_starts_at, b.seconds_ends_at, outcome);

            return outcome;
        }

        var newClashGroup = function (firstBooking) {
            var clashGroup = {
                seconds_starts_at: firstBooking.class_session.seconds_starts_at,
                seconds_ends_at: firstBooking.class_session.seconds_ends_at,

                clashes: [],

                addBooking: function (booking) {
                    clashGroup.seconds_starts_at = Math.min(clashGroup.seconds_starts_at, booking.class_session.seconds_starts_at);
                    clashGroup.seconds_ends_at = Math.max(clashGroup.seconds_ends_at, booking.class_session.seconds_ends_at);

                    clashGroup.clashes.push({
                        booking: booking
                    });

                    return true;
                }
            };

            clashGroup.addBooking(firstBooking);

            return clashGroup;
        };


        $scope.updateTimetable = function() {
            var timetable = timetableFactory.createEmptyTimetable();

            angular.forEach($scope.chosenTopics, function(topic) {
                angular.forEach(topic.classes, function(class_type) {
                    if (typeof class_type.class_groups.length === 0 || typeof class_type.active_class_group === "undefined") {
                        return;
                    }

                    // TODO: copy all class types to array and sort chronologically before processing this
                    // If we do that, we avoid an obscure bug where two two clash groups won't be merged if
                    // there's a shared member, and we only need to check the immediately previous clash group
                    // rather than EVERY previous clash group

                    angular.forEach(class_type.active_class_group.class_sessions, function(class_session) {
                        var booking = {};

                        booking.topic = topic;
                        booking.class_type = class_type;
                        booking.class_group = class_type.active_class_group;
                        booking.class_session = class_session;

                        var day = class_session.day_of_week;

                        var clashGroups = timetable[day];
                        var clashGroup = null;

                        angular.forEach(clashGroups, function (group) {
                            if (sessionsClash(group, class_session)) {
                                clashGroup = group;
                            }
                        });

                        if (clashGroup == null) {
                            clashGroup = newClashGroup(booking);
                            timetable[day].push(clashGroup);
                        }
                        else {
                            console.log("Appending booking");
                            clashGroup.addBooking(booking);
                        }

                    });
                });
            });

            $scope.timetable = timetable;

            updatePossibleTimetables();
        }

        $scope.days = days;
        $scope.hours = hours;
        $scope.timetable = timetableFactory.createEmptyTimetable();

        $scope.years = [2013];
        $scope.activeYear = $scope.years[0];

        $scope.semesters = ["S1", "NS1", "S2", "NS2"];
        $scope.activeSemester = $scope.semesters[2];




        topicFactory.getSubjectAreasAsync(function (data) {
            $scope.subjectAreas = data;
            $scope.activeSubjectArea = data[0];
            $scope.updateTopics();
        });
    })
}