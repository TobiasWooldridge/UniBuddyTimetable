angular.module('flindersTimetable.generator', [])
    .factory('timetablePriorityFactory', function (dayService) {
        var timetablePriorityFactory = {};

        var createTimetablePriority = function (label, sorter, options, defaultOption) {
            return {
                label: label,
                sorter: sorter,
                options: options,
                selectedOption: defaultOption
            };
        };

        var minimize = function (a, b) {
            return a - b;
        };

        var maximize = function (a, b) {
            return -minimize(a, b);
        };

        timetablePriorityFactory.createEarlierLaterPriority = function (label, property, defaultOption) {
            var priority = createTimetablePriority(label);

            var optionDirections = {
                'earlier': minimize,
                'later': maximize
            };

            priority.sorter = function (a, b) {
                return optionDirections[priority.selectedOption](a[property], b[property]);
            };

            priority.options = ['earlier', 'later'];
            priority.selectedOption = defaultOption;

            return priority;
        };

        timetablePriorityFactory.createDayOfWeekProperty = function (label, property) {
            var priority = createTimetablePriority(label);


            priority.sorter = function (a, b) {
                var dayOfWeek = dayService.dayNameToDayOfWeek(priority.selectedOption);
                return minimize(a[property][dayOfWeek], b[property][dayOfWeek]);
            };

            priority.options = dayService.days();
            priority.selectedOption = priority.options[0];

            return priority;
        };

        timetablePriorityFactory.createAllTimetablePriorities = function() {
            var timetablePriorities = [];

            timetablePriorities.push(createTimetablePriority('Minimize days at uni', function (a, b) {
                return minimize(a.daysAtUni, b.daysAtUni);
            }));

            timetablePriorities.push(createTimetablePriority('Minimize time at uni', function (a, b) {
                return minimize(a.secondsAtUni, b.secondsAtUni);
            }));

            timetablePriorities.push(createTimetablePriority('Consistent start time', function (a, b) {
                return minimize(a.startTimeVariability, b.startTimeVariability);
            }));

            timetablePriorities.push(timetablePriorityFactory.createEarlierLaterPriority("Start weekend", "weekendStartsAt", "earlier"));
            timetablePriorities.push(timetablePriorityFactory.createEarlierLaterPriority("Start day", "averageStartTime", "later"));

            timetablePriorities.push(timetablePriorityFactory.createDayOfWeekProperty("Minimize time at uni on", "secondsAtUniByDay", "later"));

            return timetablePriorities;
        };



        timetablePriorityFactory.createTimetableComparator = function(priorities) {
            return function(a, b) {
                var difference = 0;

                for (var i = 0; i < priorities.length; i++) {
                    var priority = priorities[i];

                    difference = priority.sorter(a.stats, b.stats);

                    if (difference !== 0) {
                        break;
                    }
                }

                return difference;
            };
        };

        return timetablePriorityFactory;
    })

    .factory('timetableSpecFactory', function() {
        var timetableSpecFactory = {};

        timetableSpecFactory.newTimetableSpec = function (classType, classGroup) {
            return {
                classType: classType,
                classGroup: classGroup
            };
        };

        return timetableSpecFactory;
    })



    .factory('timetablePossibilityFactory', function (topicService, timetableSpecFactory, clashService) {
        var timetablePossibilityFactory = {};

        timetablePossibilityFactory.countPossibleTimetables = function (topics) {
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



        timetablePossibilityFactory.findTimetablesWithMinimumClashes = function (topics) {
            if (topics.length === 0) {
                return [];
            }

            var allClassGroups = topicService.listClassGroupsForTopics(topics);

            var fewestSecondsClashing = Number.MAX_VALUE;

            var generatedTimetables = [];


            var examineAndAddTimetable = function (classGroupSelections, numClashes) {
                if (numClashes < fewestSecondsClashing) {
                    fewestSecondsClashing = numClashes;
                    generatedTimetables = [];
                }

                if (numClashes <= fewestSecondsClashing) {
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
                    if (secondsClashesCurrent <= fewestSecondsClashing) {
                        // Work with this group for now
                        previousClassGroupSelections[currentGroup.id] = timetableSpecFactory.newTimetableSpec(currentClassType, currentGroup);

                        if (remainingClassChoices.length === 0) {
                            // No more choices we can make, check if this timetable is good and move on
                            examineAndAddTimetable(previousClassGroupSelections, secondsClashesCurrent);
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

            searchTimetables(chosenClassGroups, remainingClassChoices, 0);



            return generatedTimetables;
        };



        return timetablePossibilityFactory;
    })


    .factory('timetableGeneratorService', function(dayService, arrayMath, timetablePriorityFactory, timetableSpecFactory) {
        var timetableGeneratorService = {};

        timetableGeneratorService.calculateTimeMetrics = function (timetable) {
            var secondsInDay = 24 * 60 * 60;

            var days = { };

            var secondsOfClassesByDay = [0, 0, 0, 0, 0];

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

                secondsOfClassesByDay[session.dayOfWeek] += session.secondsDuration;
            });

            var startTimes = [];
            var endTimes = [];
            var secondsAtUni = [0, 0, 0, 0, 0];
            var weekendStartsAt = 0;

            angular.forEach(days, function (day, dayName) {
                var dayOfWeek = dayService.dayNameToDayOfWeek(dayName);

                secondsAtUni[dayOfWeek] = day.secondsEndsAt - day.secondsStartsAt;

                startTimes.push(day.secondsStartsAt);
                endTimes.push(day.secondsEndsAt);

                weekendStartsAt = Math.max(weekendStartsAt, dayOfWeek * secondsInDay + day.secondsEndsAt);
            });

            var stats = {};

            stats.daysAtUni = startTimes.length;

            stats.secondsOfClassesByDay = secondsOfClassesByDay;

            stats.startTimes = startTimes;
            stats.endTimes = endTimes;

            stats.secondsAtUniByDay = secondsAtUni;
            stats.secondsAtUni = arrayMath.sum(secondsAtUni);

            stats.earliestStartTime = arrayMath.min(startTimes);
            stats.latestEndTime = arrayMath.max(endTimes);

            stats.averageStartTime = arrayMath.mean(startTimes);
            stats.averageEndTime = arrayMath.mean(endTimes);

            stats.startTimeVariability = arrayMath.variability(startTimes);
            stats.weekendStartsAt = weekendStartsAt;

            return stats;
        };

        timetableGeneratorService.classSessionsForClassPicks = function (classPicks) {
            var classSessions = [];

            angular.forEach(classPicks, function (classPick) {
                classSessions = classSessions.concat(classPick.classGroup.classSessions);
            });

            return classSessions;
        };

        timetableGeneratorService.sortTimetablesByPriorities = function (generatedTimetables, priorities) {
            var timetables = [];

            // Wrap each timetable and calculate statistics and stuff
            angular.forEach(generatedTimetables, function (generatedTimetable) {
                var timetable = {};

                timetable.classPicks = generatedTimetable;
                timetable.classSessions = timetableGeneratorService.classSessionsForClassPicks(generatedTimetable);

                timetable.stats = timetableGeneratorService.calculateTimeMetrics(timetable);

                timetables.push(timetable);
            });

            // Sort timetables by the user-defined priorities
            timetables.sort(timetablePriorityFactory.createTimetableComparator(priorities));

            return timetables;
        };

        return timetableGeneratorService;
    })

;