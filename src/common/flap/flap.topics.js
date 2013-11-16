angular.module( 'flap.topics', [
        'flap.objectUtils',
        'flap.stringUtils'
    ])
    .constant('apiPath', "http://flindersapi.tobias.pw/api/v1/")

    .factory('topicFactory', function (apiPath, $http, sessionsService, camelCaseService, topicService, hashService, classNameService) {
        var baseTopic = {
            getSerial: function () {
                var serial = this.uniqueTopicCode;

                var firstClass = true;

                angular.forEach(this.classes, function (classType) {
                    if (typeof(classType.activeClassGroup) === "undefined") {
                    }
                    else if (classType.classGroups.length <= 1) {
                    }
                    else {
                        serial += firstClass ? "-(" : "-";
                        serial += classNameService.simplifyName(classType.name) + classType.activeClassGroup.groupId;

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
                return hashService.hash(this.uniqueTopicCode);
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
            var url = apiPath + 'topics/' + topicId + '.json';

            $http.get(url).success(function (data, status, headers, config) {
                camelCaseService.camelCaseObject(data);

                callback(data, status, headers, config);
            });
        };

        topicFactory.createTopicFromUniqueTopicCode = function (serial) {
            var syntax = /^(([0-9]{4})\-([A-Z0-9]{1,4})\-([A-Z]{4})([0-9]{4}[A-Z]?))/i;

            var topicIdentifier = syntax.exec(serial);

            if (!topicIdentifier) {
                return false;
            }

            var topic = {
                uniqueTopicCode: topicIdentifier[1],
                year: topicIdentifier[2],
                semester: topicIdentifier[3],
                subjectArea: topicIdentifier[4],
                topicNumber: topicIdentifier[5],
                code: topicIdentifier[4] + topicIdentifier[5]
            };

            return topic;
        };

        topicFactory.loadTopicFromSerialAsync = function (topicSerial, callback) {

            var topic = topicFactory.createTopicFromUniqueTopicCode(topicSerial);

            if (!topic) {
                return false;
            }

            // TODO: Improve the following method (parse string with regex)
            var parens = /\((.*)\)/;

            var bracketSets = parens.exec(topicSerial);

            var hasClassSelections = bracketSets !== null;

            if (hasClassSelections) {
                var getClassesRegex = /([(A-Za-z]+)([0-9]+)-?/g;
                var classSelections = {};

                while (classSelection = getClassesRegex.exec(bracketSets[1])) {
                    classSelections[classSelection[1]] = classSelection[2];
                }
            }


            angular.extend(topic, baseTopic);

            topicFactory.loadTimetableForTopicAsync(topic, function (topic, status, headers, config) {
                if (hasClassSelections) {
                    angular.forEach(topic.classes, function (classType) {
                        var strippedName = classNameService.simplifyName(classType.name);

                        if (typeof classSelections[strippedName] !== "undefined") {
                            classType.activeClassGroup = classType.classGroups[classSelections[strippedName] - 1];
                        }

                    });
                }

                callback(topic, status, headers, config);
            });

            return topic;
        };

        topicFactory.loadTimetableForTopicAsync = function (topic, callback) {
            topicFactory.getTopicAsync(topic.uniqueTopicCode, function (remoteTopicEntry, status, headers, config) {
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

;