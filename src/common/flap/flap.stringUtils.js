angular.module('flap.stringUtils', [] )
    .factory('hashService', function () {
        var hashService = {
            hash: function (str) {
                var hash = 0;
                if (!str) {
                    return hash;
                }

                for (var i = 0, l = str.length; i < l; i++) {
                    var c = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + c;
                    hash |= 0;
                }
                return Math.abs(hash);
            }
        };

        return hashService;
    })
;