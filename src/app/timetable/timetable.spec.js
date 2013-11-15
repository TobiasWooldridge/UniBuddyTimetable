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
        var topicFactory = {};
        topicController = $controller('TopicController', {$scope: scope, chosenTopicService: $injector.get('chosenTopicService'), topicFactory: topicFactory, urlService: $injector.get('urlService')});
    }));

    it('should have a dummy test', inject(function() {
        expect(true).toBeTruthy();
    }));


    it('should define scope', function () {
        expect(scope).toBeDefined();
    });
    
});