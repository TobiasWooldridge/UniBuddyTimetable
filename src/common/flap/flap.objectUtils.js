angular.module('flap.objectUtils', [] )
    .factory('camelCaseService', function () {
        /**
         * Convert a given string to camelCase
         *
         * @param {string} str The string to camelcase
         * @returns {string} str in camelCase
         */
        var camelCase = function (str) {
            return str.toLowerCase().replace(/[_-](.)/g, function (m, g) {
                return g.toUpperCase();
            });
        };

        var that = {};

        /**
         * camelCase all of the keys in an object recursively. Originally designed for dealing with underscore-oriented remote APIs
         *
         * @param object
         * @returns {*} the same object, with all keys in the object recursively camelcased
         */
        that.camelCaseObject = function (object) {
            if (typeof object !== "object") {
                // We can't camelcase the keys of an object
                return;
            }

            var keys = [];
            for (var key in object) {
                keys.push(key);
            }

            for (var i = 0; i < keys.length; i++) {
                var oldKey = keys[i];
                var newKey = camelCase(oldKey);

                if (oldKey !== newKey) {
                    object[newKey] = object[oldKey];
                    delete(object[oldKey]);
                }

                that.camelCaseObject(object[newKey]);
            }

            return object;
        };

        return that;
    })
;