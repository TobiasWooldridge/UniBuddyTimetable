angular.module('stopwatch', [])
    .factory('stopwatch', function () {
        function now() {
            return new Date().getTime();
        }

        return function stopwatch() {
            var started;

            var watch = {
                reset : function reset() {
                    started = now();
                },
                elapsedMillis : function elapsedMillis() {
                    return now() - started;
                },
                elapsedSeconds : function elapsedSeconds() {
                    return watch.elapsedMillis() / 1000;
                }
            };

            watch.reset();

            return watch;
        };
    })
;