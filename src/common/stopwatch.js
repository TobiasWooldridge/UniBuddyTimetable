angular.module('stopwatch', [])
    .factory('stopwatch', function () {
        var now;

        // Ultra high resolution timer for vanity reasons :P
        if (window.performance && window.performance.now) {
            now = function now() {
                return window.performance.now();
            };
        }
        else {
            now = function legacyNow() {
                return new Date().getTime();
            };
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