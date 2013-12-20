angular.module('flindersTimetable.generator', [])
/**
 * Factory for creating one or many TimetablePrioritys, which are ways to comparing two Timetables.
 */
    .factory('timetablePriorityFactory', function (dayService) {
        var timetablePriorityFactory = {};

        /**
         * Create a TimetablePriority
         * @param label The text that'll be displayed for this TimetablePriority
         * @param [sorter] The method this TimetablePriority will compare timetables by
         * @param [options] The options that will be shown in a dropdown for this TimetablePriority
         * @param [defaultOption] The option which will be selected by default for this TimetablePriority
         * @returns TimetablePriority
         */
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

        /**
         * Create a timetablePriority which can be configured for 'earlier' or 'later' by the user
         *
         * @param label The name of the priority. Should be an incomplete sentence that can be ended by 'earlier' or 'later'
         * @param property The stat to sort timetables by based on this earlier/later value
         * @param defaultOption The default value (earlier/later) for this prioritys
         * @returns TimetablePriority
         */
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

        /**
         * Create a timetablePriority which can be configured for some day of week by the user
         *
         * @param label The name of the priority. Should be an incomplete sentence that can be ended by a day of week
         * @param property The stat to sort timetables by based on this day value
         * @returns TimetablePriority
         */
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

        /**
         * Create a list containing one of every timetablePriority
         * @returns {Array} of timetablePrioritys
         */
        timetablePriorityFactory.createAllTimetablePriorities = function () {
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


        /**
         * Create a method which compares two timetables for the purposes of sorting, based on the list of priorities provided.
         *
         * @param priorities An ordered list of priorities to sort by (highest preference at start)
         * @returns {Function} which can be used to compare two timetables with stats
         */
        timetablePriorityFactory.createTimetableComparator = function (priorities) {
            return function (a, b) {
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

    .factory('timetableSpecFactory', function () {
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


        timetablePossibilityFactory.findTimetablesWithMinimumClashes = function (topics, config) {
            // Add in default config values if they're undefined
            config = angular.extend({
                avoidFull: true,
                clashAllowance: 0
            }, config);


            if (topics.length === 0) {
                return [];
            }

            var fewestSecondsClashing = Number.MAX_VALUE;
            var allowedSecondsClashing = Number.MAX_VALUE;

            var generatedTimetables = [];

            var examineAndAddTimetable = function (classGroupSelections, secondsOfClashes) {
                if (secondsOfClashes < fewestSecondsClashing) {
                    fewestSecondsClashing = secondsOfClashes;
                    allowedSecondsClashing = fewestSecondsClashing + config.clashAllowance;

                    // Remove all previously generated timetables with too many seconds of clashes
                    var limitedGeneratedTimetables = [];

                    angular.forEach(generatedTimetables, function (generatedTimetable) {
                        if (generatedTimetable.secondsOfClashes <= allowedSecondsClashing) {
                            limitedGeneratedTimetables.push(generatedTimetable);
                        }
                    });

                    generatedTimetables = limitedGeneratedTimetables;
                }

                if (secondsOfClashes <= allowedSecondsClashing) {
                    generatedTimetables.push({
                        secondsOfClashes: secondsOfClashes,
                        selections: angular.extend({}, classGroupSelections)
                    });
                }
            };

            var filterOutFullGroups = function (groups) {
                var openGroups = [];

                angular.forEach(groups, function (currentGroup) {
                    if (!currentGroup.full) {
                        openGroups.push(currentGroup);
                    }
                });

                return openGroups;
            };

            /**
             * Recursive method used for enumerating every possible timetable. Uses 'secondsClashesPrior' to skip some timetables where sensible.
             * @param previousClassGroupSelections
             * @param remainingClassChoices
             * @param secondsClashesPrior
             */
            var searchTimetables = function (previousClassGroupSelections, remainingClassChoices, secondsClashesPrior) {
                var currentClassType = remainingClassChoices.pop();

                var eligibleGroups = [];

                if (config.avoidFull) {
                    eligibleGroups = filterOutFullGroups(currentClassType.classGroups);
                }

                if (eligibleGroups.length === 0) {
                    eligibleGroups = currentClassType.classGroups;
                }

                angular.forEach(eligibleGroups, function (currentGroup) {
                    var secondsClashesCurrent = secondsClashesPrior;

                    angular.forEach(previousClassGroupSelections, function (previousClassGroupSelection) {
                        secondsClashesCurrent += clashService.classGroupsClash(currentGroup, previousClassGroupSelection.classGroup);
                    });


                    // Make sure we're not exceeding our clash limit
                    if (secondsClashesCurrent <= allowedSecondsClashing) {
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


            var timetables = [];

            angular.forEach(generatedTimetables, function (generatedTimetable) {
                timetables.push(generatedTimetable.selections);
            });

            return timetables;
        };

        return timetablePossibilityFactory;
    })


    .factory('timetableGeneratorService', function (dayService, arrayMath, timetablePriorityFactory) {
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