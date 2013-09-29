function timetable(userConfig) {
    var config = {
        api_path: "http://flindersapi.tobias.pw/api/v1/"
    };

    for (var key in userConfig) {
        if (userConfig.hasOwnProperty(key)) {
            config[key] = userConfig[key];
        }
    }


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
            getTopicsAsync: function (subject_area, year, semester, callback) {
                var url = config.api_path + 'topics' + "?"

                if (subject_area !== "Any")
                    url += "&subject_area=" + subject_area;
                if (year !== "Any")
                    url += "&year=" + year;
                if (semester !== "Any")
                    url += "&semester=" + semester;

                $http.get(url).success(function (data, status, headers, config) {
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

    app.controller('TimetableController', function ($scope, topicFactory) {
        $scope.chosenTopics = []

        $scope.updateTopic = function () {
            topicFactory.getTopicsAsync($scope.activeSubjectArea, $scope.activeYear, $scope.activeSemester, function (data) {
                $scope.topics = data;
            });
        }

        $scope.addTopic = function () {
            topicId = $scope.activeTopic;
            topicFactory.getTopicAsync(topicId, function (topic) {
                $scope.chosenTopics.push(topic);

                topicFactory.getTimetableAsync(topicId, function (class_types) {

                    angular.forEach(class_types, function(class_type) {
                        class_type.active_class_group = class_type.class_groups[0];
                    });


                    topic.classes = class_types;
                });
            });
        }

        $scope.selectClassGroup = function (classGroup) {

        }

        $scope.years = [new Date().getFullYear()];
        $scope.activeYear = $scope.years[0];

        $scope.semesters = ["S1", "NS1", "S2", "NS2"];
        $scope.activeSemester = $scope.semesters[2];

        topicFactory.getSubjectAreasAsync(function (data) {
            $scope.subjectAreas = data;
            $scope.activeSubjectArea = data[0];
            $scope.updateTopic();
        });

        // Hardcoding this for now #YOLO
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        hours = ["8 AM", "9AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM"];

        timetable = {}

        angular.forEach(hours, function (hour) {
            timetable[hour] = {}
            angular.forEach(days, function (day) {
                timetable[hour][day] = [];
            });
        })

        $scope.days = days;
        $scope.hours = hours;
        $scope.timetable = timetable;
    })
}