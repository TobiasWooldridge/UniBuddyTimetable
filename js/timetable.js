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
            getTimetableAsync: function (topic_id, callback) {
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
        }

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

                topicFactory.getTimetableAsync(topicId, function (class_types) {
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


        $scope.updateTimetable = function() {
            var timetable = timetableFactory.createEmptyTimetable();


            angular.forEach($scope.chosenTopics, function(topic) {
                angular.forEach(topic.classes, function(class_type) {
                    if (typeof class_type.class_groups.length === 0 || typeof class_type.active_class_group === "undefined") {
                        return;
                    }


                    angular.forEach(class_type.active_class_group.class_sessions, function(class_session) {
                        var day = class_session.day_of_week;

                        var booking = {};

                        booking.topic = topic;
                        booking.class_type = class_type;
                        booking.class_group = class_type.active_class_group;
                        booking.class_session = class_session

                        timetable[day].push(booking);
                    });
                });
            });

            $scope.timetable = timetable;
        }

        $scope.days = days;
        $scope.hours = hours;
        $scope.timetable = timetableFactory.createEmptyTimetable();

        $scope.years = [2013, 2014];
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