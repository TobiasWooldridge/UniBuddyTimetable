
angular.module('arrayMath', [])
    .factory('arrayMath', function () {
    var arrayMath = {
        max: function (arr) {
            return Math.max.apply(null, arr);
        },
        min: function (arr) {
            return Math.min.apply(null, arr);
        },
        sum: function (arr) {
            var sum = 0;

            for (var i = 0; i < arr.length; i++) {
                sum += arr[i];
            }

            return sum;
        },
        mean: function (arr) {
            var sum = arrayMath.sum(arr);
            return sum / arr.length;
        },
        variance: function (arr) {
            var sumOfSquares = 0;

            for (var i = 0; i < arr.length; i++) {
                sumOfSquares += Math.pow(arr[i], 2);
            }

            var variance = sumOfSquares / arr.length - Math.pow(arrayMath.mean(arr), 2);

            return variance;
        },
        variability: function (arr) {
            arr = angular.copy(arr);

            arr.sort();

            var previous = arr[0];

            var variability = 0;
            for (var i = 1; i < arr.length; i++) {
                variability += Math.abs(arr[i] - previous);

                previous = arr[i];
            }

            return variability;
        }
    };

    return arrayMath;
})

;