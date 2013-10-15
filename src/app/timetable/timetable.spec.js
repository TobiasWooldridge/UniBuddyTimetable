describe('FlindersTimetable clash service', function () {
    var clashService;

    beforeEach(module('flindersTimetable.timetable'));
    beforeEach(inject(function ($injector) {
        clashService = $injector.get('clashService');
    }));


    it('should have a dummy test', inject(function () {
        expect(true).toBeTruthy();
    }));


    it('should detect a session clashes with itself', function () {
        var a = {
            first_day: "2013-08-06",
            last_day: "2013-11-05",
            day_of_week: "Tuesday",
            time_starts_at: "12:00 PM",
            time_ends_at: "1:50 PM",
            seconds_starts_at: 43200,
            seconds_ends_at: 49800,
            seconds_duration: 6600,
            room: null
        };

        expect(clashService.sessionsClash(a, a)).toBeTruthy();
    });


    it('should detect no clash for two identical sessions on different days', function () {
        var a = {
            first_day: "2013-08-06",
            last_day: "2013-11-05",
            day_of_week: "Tuesday",
            time_starts_at: "12:00 PM",
            time_ends_at: "1:50 PM",
            seconds_starts_at: 0,
            seconds_ends_at: 600,
            seconds_duration: 600,
            room: null
        };

        var b = {
            first_day: "2013-08-07",
            last_day: "2013-11-06",
            day_of_week: "Wednesday",
            time_starts_at: "12:00 PM",
            time_ends_at: "1:50 PM",
            seconds_starts_at: 0,
            seconds_ends_at: 600,
            seconds_duration: 600,
            room: null
        };

        expect(clashService.sessionsClash(a, b)).toBeFalsy();
    });


    it('should detect no clash for two successive sessions', function () {
        var a = {
            first_day: "2013-08-06",
            last_day: "2013-11-05",
            day_of_week: "Tuesday",
            time_starts_at: "12:00 AM",
            time_ends_at: "12:10 AM",
            seconds_starts_at: 0,
            seconds_ends_at: 600,
            seconds_duration: 600,
            room: null
        };

        var b = {
            first_day: "2013-08-06",
            last_day: "2013-11-05",
            day_of_week: "Tuesday",
            time_starts_at: "12:10 AM",
            time_ends_at: "12:20 AM",
            seconds_starts_at: 600,
            seconds_ends_at: 1200,
            seconds_duration: 600,
            room: null
        };

        expect(clashService.sessionsClash(a, b)).toBeFalsy();
    });


    it('should detect no clash for two completely discrete sessions', function () {
        var a = {
            first_day: "2013-08-06",
            last_day: "2013-11-05",
            day_of_week: "Tuesday",
            time_starts_at: "12:00 AM",
            time_ends_at: "12:10 AM",
            seconds_starts_at: 0,
            seconds_ends_at: 600,
            seconds_duration: 600,
            room: null
        };

        var b = {
            first_day: "2013-08-06",
            last_day: "2013-11-05",
            day_of_week: "Tuesday",
            time_starts_at: "12:20 AM",
            time_ends_at: "12:30 AM",
            seconds_starts_at: 1200,
            seconds_ends_at: 1800,
            seconds_duration: 600,
            room: null
        };

        expect(clashService.sessionsClash(a, b)).toBeFalsy();
    });
});

