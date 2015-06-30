angular.module('unibuddyTimetable.config', [])
    .constant('times', {
        years: [ 2011, 2012, 2013, 2014, 2015 ],
        defaultYear: 2015,
        defaultSemester: "S2,NS2,SP4,SP5,SP6"
    })

    .constant('timetablesPerPage', 5)
    .constant('maxTimetablePages', 10)
;