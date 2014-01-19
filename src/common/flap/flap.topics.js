angular.module( 'flap.topics', [
        'flap.objectUtils',
        'flap.stringUtils'
    ])
    .constant('apiPath', "http://api.unibuddy.com.au/api/v2/uni/flinders/")

    .factory('topicFactory', function (apiPath, $http, sessionsService, camelCaseService, topicService, hashService) {
        var baseTopic = {
            getSerial: function () {
                var serial = this.id;

                var firstClass = true;

                angular.forEach(this.classes, function (classType) {
                    if (typeof(classType.activeClassGroup) === "undefined") {
                    }
                    else if (classType.classGroups.length <= 1) {
                    }
                    else {
                        serial += firstClass ? "-(" : "-";
                        serial += classType.id + '-' + classType.activeClassGroup.groupId;

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
                return this.id ^ 47;
            }
        };

        var topicFactory = {};

        topicFactory.getTopicsAsync = function (query, callback) {
            var url = apiPath + 'topics.json' + "?";

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

            $http.get(url).success(function (response, status, headers, config) {
                topics = response.data;


                camelCaseService.camelCaseObject(topics);

                topicService.sortTopics(topics);

                angular.forEach(topics, function (topic) {
                    angular.extend(topic, baseTopic);
                });

                callback(topics, status, headers, config);
            });
        };

        topicFactory.getTopicAsync = function (topicId, callback) {
            var url = apiPath + 'topics/' + topicId + '.json';

            $http.get(url).success(function (response, status, headers, config) {
                topic = response.data;

                camelCaseService.camelCaseObject(topic);

                callback(topic, status, headers, config);
            });
        };

        topicFactory.createTopicFromId = function (serial) {
            var syntax = /^([0-9]+)/;

            var topicIdentifier = syntax.exec(serial);

            if (!topicIdentifier) {
                return false;
            }

            var topic = {
                id: topicIdentifier[1]
            };

            return topic;
        };

        topicFactory.loadTopicFromSerialAsync = function (topicSerial, callback) {
            var topic = topicFactory.createTopicFromId(topicSerial);

            if (!topic) {
                return false;
            }

            // TODO: Improve the following method (parse string with regex)
            var parens = /\((.*)\)/;

            var bracketSets = parens.exec(topicSerial);

            var hasActivities = (bracketSets !== null);

            if (hasActivities) {
                var getClassesRegex = /([(A-Za-z]+)([0-9]+)-?/g;
                var classSelections = {};

                while (classSelection = getClassesRegex.exec(bracketSets[1])) {
                    classSelections[classSelection[1]] = classSelection[2];
                }
            }

            console.log(topicSerial, topic.id, bracketSets);



            angular.extend(topic, baseTopic);

            topicFactory.loadTimetableForTopicAsync(topic, function (topic, status, headers, config) {
                if (hasActivities) {
                    angular.forEach(topic.classes, function (classType) {
                        var id = classType.id;

                        if (typeof classSelections[id] !== "undefined") {
                            classType.activeClassGroup = classType.classGroups[classSelections[id] - 1];
                        }

                    });
                }

                callback(topic, status, headers, config);
            });

            return topic;
        };

        topicFactory.loadTimetableForTopicAsync = function (topic, callback) {
            topicFactory.getTopicAsync(topic.id, function (remoteTopicEntry, status, headers, config) {
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

    .factory('topicService', function () {
        var that = {};

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
            var codeDifference = a.code.localeCompare(b.code);
            if (codeDifference !== 0) {
                return codeDifference;
            }

            return a.name.localeCompare(b.name);
        }

        that.sortTopics = function (topics) {
            return topics.sort(compareTopics);
        };

        return that;
    })

;