angular.module('colorAllocator', [])
    .constant('numTopicColors', 9)
    .factory('colorAllocator', function (numTopicColors) {
        var recentlyAssigned = [];

        var assignments = {};

        return function assignColor (topicHash) {
            if (assignments[topicHash] !== undefined) {
                return assignments[topicHash];
            }

            var colorId = topicHash % numTopicColors;

            if (recentlyAssigned.length == numTopicColors) {
                colorId = recentlyAssigned.shift();
            }
            else if (recentlyAssigned.indexOf(colorId) !== -1) {
                colorId = Math.floor(Math.random() * numTopicColors);
            }

            assignments[topicHash] = colorId;
            recentlyAssigned.push(colorId);
            return colorId;
        };
    })
;
