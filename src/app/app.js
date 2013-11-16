angular.module('flindersTimetable', [
        'templates-app',
        'templates-common',
        'flindersTimetable.timetable',
        'ui.state',
        'ui.route'
    ])

    .config(function myAppConfig($stateProvider, $urlRouterProvider, $locationProvider) {
        $urlRouterProvider.otherwise('/');
        $locationProvider.html5Mode(true);
    })

    .run(function run() {
    })

    .controller('AppCtrl', function AppCtrl($scope, $location) {

        $scope.$on('$stateChangeSuccess', function (event, toState, toParams, fromState, fromParams) {
            if (angular.isDefined(toState.data.pageTitle)) {
                $scope.pageTitle = toState.data.pageTitle;// + ' | Flinders Timetable';
            }
        });
    })
;

