describe('FlindersTimetable clash service', function () {
    var clashService;

    beforeEach(module('flindersTimetable.timetable'));
    beforeEach(inject(function ($injector) {
        clashService = $injector.get('clashService');
    }));


    it('should be defined', inject(function () {
        expect(clashService).toBeDefined();
    }));


    it('should detect a session clashes with itself', function () {
        var a = {
            firstDay: "2013-08-06",
            lastDay: "2013-11-05",
            dayOfWeek: "Tuesday",
            timeStartsAt: "12:00 PM",
            timeEndsAt: "1:50 PM",
            secondsStartsAt: 43200,
            secondsEndsAt: 49800,
            secondsDuration: 6600,
            room: null
        };

        expect(clashService.sessionsClash(a, a)).toBeTruthy();
    });


    it('should detect no clash for two identical sessions on different days', function () {
        var a = {
            firstDay: "2013-08-06",
            lastDay: "2013-11-05",
            dayOfWeek: "Tuesday",
            timeStartsAt: "12:00 PM",
            timeEndsAt: "1:50 PM",
            secondsStartsAt: 0,
            secondsEndsAt: 600,
            secondsDuration: 600,
            room: null
        };

        var b = {
            firstDay: "2013-08-07",
            lastDay: "2013-11-06",
            dayOfWeek: "Wednesday",
            timeStartsAt: "12:00 PM",
            timeEndsAt: "1:50 PM",
            secondsStartsAt: 0,
            secondsEndsAt: 600,
            secondsDuration: 600,
            room: null
        };

        expect(clashService.sessionsClash(a, b)).toBeFalsy();
    });


    it('should detect no clash for two successive sessions', function () {
        var a = {
            firstDay: "2013-08-06",
            lastDay: "2013-11-05",
            dayOfWeek: "Tuesday",
            timeStartsAt: "12:00 AM",
            timeEndsAt: "12:10 AM",
            secondsStartsAt: 0,
            secondsEndsAt: 600,
            secondsDuration: 600,
            room: null
        };

        var b = {
            firstDay: "2013-08-06",
            lastDay: "2013-11-05",
            dayOfWeek: "Tuesday",
            timeStartsAt: "12:10 AM",
            timeEndsAt: "12:20 AM",
            secondsStartsAt: 600,
            secondsEndsAt: 1200,
            secondsDuration: 600,
            room: null
        };

        expect(clashService.sessionsClash(a, b)).toBeFalsy();
    });


    it('should detect no clash for two completely discrete sessions', function () {
        var a = {
            firstDay: "2013-08-06",
            lastDay: "2013-11-05",
            dayOfWeek: "Tuesday",
            timeStartsAt: "12:00 AM",
            timeEndsAt: "12:10 AM",
            secondsStartsAt: 0,
            secondsEndsAt: 600,
            secondsDuration: 600,
            room: null
        };

        var b = {
            firstDay: "2013-08-06",
            lastDay: "2013-11-05",
            dayOfWeek: "Tuesday",
            timeStartsAt: "12:20 AM",
            timeEndsAt: "12:30 AM",
            secondsStartsAt: 1200,
            secondsEndsAt: 1800,
            secondsDuration: 600,
            room: null
        };

        expect(clashService.sessionsClash(a, b)).toBeFalsy();
    });
});


describe('FlindersTimetable dayService', function () {
    var dayService;

    beforeEach(module('flindersTimetable.timetable'));
    beforeEach(inject(function ($injector) {
        dayService = $injector.get('dayService');
    }));


    it('should have a dummy test', inject(function () {
        expect(true).toBeTruthy();
    }));


    it('should convert day names to integers correctly', function () {
        expect(dayService.dayOfWeekToDayName(0)).toBe("Monday");
        expect(dayService.dayOfWeekToDayName(1)).toBe("Tuesday");
        expect(dayService.dayOfWeekToDayName(2)).toBe("Wednesday");
        expect(dayService.dayOfWeekToDayName(3)).toBe("Thursday");
        expect(dayService.dayOfWeekToDayName(4)).toBe("Friday");
    });


    it('should work symmetrically between dayOfWeekToDayName and dayNameToDayOfWeek', function () {
        for (var i = 0; i < 5; i++) {
            expect(dayService.dayNameToDayOfWeek(dayService.dayOfWeekToDayName(i))).toBe(i);
        }
    });

});

describe('flindersTimetable TopicController', function () {
    var scope;
    var topicController;

    beforeEach(module('flindersTimetable.timetable'));
    beforeEach(inject(function ($rootScope, $controller, $injector) {
        scope = $rootScope.$new();
        //topicFactory bypass
        var topicFactory = {getTopicsAsync: function () {
        },
            getTopicAsync: function () {
            },
            createTopicFromUniqueTopicCode: function () {
            },
            loadTopicFromSerialAsync: function () {
            },
            loadTimetableForTopicAsync: function () {
            }
        };
        topicController = $controller('TopicController', {$scope: scope, chosenTopicService: $injector.get('chosenTopicService'), topicFactory: topicFactory, urlService: $injector.get('urlService')});
    }));

    it('should have a dummy test', inject(function () {
        expect(true).toBeTruthy();
    }));


    it('should define scope', function () {
        expect(scope).toBeDefined();
    });

    it('should define searchTopics', function () {
        expect(scope.searchTopics).toBeDefined();
    });

    it('should define topicSearch', function () {
        expect(scope.topicSearch).toBeDefined();
    });

    it('topicSearch of \'\' should return all members of the list when passed into the filter method', function () {
        scope.topicSearch = '';
        var topicArray = [];
        for (var i = 0; i < 10; i++) {
            topicArray.push({name: "topic" + i, code: "ENGR0000"});
        }
        expect(topicArray.length).toBe(10);
        topicArray.filter(scope.searchTopics);
        expect(topicArray.length).toBe(10);
    });

    var testCode = function(code) {
        scope.topicSearch = code;
        return scope.searchTopics({ code: 'ABCD1234A', 'name': '' });
    };

    it('should not match unknown letters', function() {
        expect(testCode('z')).toBeFalsy();
        expect(testCode('å')).toBeFalsy();
    });

    it('should match strings which are one to four letters long', function() {
        expect(testCode('a')).toBeTruthy();
        expect(testCode('ab')).toBeTruthy();
        expect(testCode('abc')).toBeTruthy();
        expect(testCode('abcd')).toBeTruthy();
    });

    it('should not match numbers shorter than 4 digits long', function() {
        expect(testCode('1')).toBeFalsy();
        expect(testCode('12')).toBeFalsy();
        expect(testCode('123')).toBeFalsy();
    });

    it('should not match numbers longer than 4 digits long', function() {
        expect(testCode('12345')).toBeFalsy();
    });

    it('should match numbers 4 digits long', function() {
        expect(testCode('1234')).toBeTruthy();
    });


    it('should match four letters followed by up to numbers', function() {
        expect(testCode('abcd1')).toBeTruthy();
        expect(testCode('abcd12')).toBeTruthy();
        expect(testCode('abcd123')).toBeTruthy();
        expect(testCode('abcd1234')).toBeTruthy();
    });

    it('should not match one-three letters followed numbers', function() {
        expect(testCode('a1')).toBeFalsy();
        expect(testCode('ab1')).toBeFalsy();
        expect(testCode('abc1')).toBeFalsy();
    });


    it('should match full topic codes', function() {
        expect(testCode('abcd1234')).toBeTruthy();
        expect(testCode('abcd1234a')).toBeTruthy();
    });

    it('should match case insensitively', function() {
        expect(testCode('abcd1234a')).toBeTruthy();
        expect(testCode('ABCD1234A')).toBeTruthy();
        expect(testCode('AbCd1234a')).toBeTruthy();
    });

});