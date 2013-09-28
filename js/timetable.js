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

    app.factory('topicFactory', function($http) {
        return {
            getSubjectAreasAsync: function (callback) {
                $http.get(config.api_path + 'subjects').success(function(data, status, headers, config) {
                    mutilated_data = []

                    angular.forEach(data, function(value) {
                        mutilated_data.push(value.subject_area);
                    });

                    callback(mutilated_data, status, headers, config);
                });
            },
            getTopicsAsync: function (subject_area, year, semester, callback) {
                var url = config.api_path + 'subjects/' + subject_area + "?"

                if (year !== "Any")
                    url += "&year=" + year;
                if (semester !== "Any")
                    url += "&semester=" + semester;

                $http.get(url).success(function(data, status, headers, config) {
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

        $scope.addTopic = function() {
            console.log($scope.activeTopic);

            $scope.chosenTopics.push(angular.fromJson($scope.activeTopic));
        }

        $scope.years = [new Date().getFullYear()];
        $scope.activeYear = $scope.years[0];

        $scope.semesters = ["S1", "NS1", "S2", "NS2"];
        $scope.activeSemester = $scope.semesters[0];

        topicFactory.getSubjectAreasAsync(function (data) {
            $scope.subjectAreas = data;
            $scope.activeSubjectArea = data[0];
            $scope.updateTopic();
        });
    })
}