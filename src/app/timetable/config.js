angular.module('unibuddyTimetable.config', [])
    .constant('times', {
        years: [ 2011, 2012, 2013, 2014 ],
        defaultYear: 2014,
        semesters: {
            "Semester 1 (includes NS1)" : "S1,NS1",
            "Semester 2 (includes NS2)" : "S2,NS2"
        },
        defaultSemester: "S1,NS1"
    })

    .constant('timetablesPerPage', 5)
    .constant('maxTimetablePages', 10)
;