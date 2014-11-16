angular.module('unibuddyTimetable.config', [])
    .constant('times', {
        years: [ 2011, 2012, 2013, 2014, 2015 ],
        defaultYear: 2015,
        defaultSemester: "S1,NS1,SP1,SP2,SP3"
    })

    .constant('timetablesPerPage', 5)
    .constant('maxTimetablePages', 10)
;