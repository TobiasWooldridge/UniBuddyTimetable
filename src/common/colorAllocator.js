angular.module('colorAllocator', [])
    .constant('topicColors', [
        '#84BF32',
        '#FFA81B',
        '#37BF32',
        '#BF2F13',
        '#007F15',
        '#FF6548',
        '#4E54FF',
        '#4ACAFF',
        '#45BFB8'
    ])
    .factory('colorAllocator', function (topicColors) {
        var recentlyAssigned = [];

        var assignments = {};

        return function assignColor (topicHash) {
            if (assignments[topicHash] !== undefined) {
                return assignments[topicHash];
            }

            var colorId = topicHash % topicColors.length;

            if (recentlyAssigned.length == topicColors.length) {
                colorId = recentlyAssigned.shift();
            }
            else if (recentlyAssigned.indexOf(colorId) !== -1) {
                colorId = Math.floor(Math.random() * topicColors.length);
            }

            assignments[topicHash] = colorId;
            recentlyAssigned.push(colorId);
            return colorId;
        };
    })

    .factory('getAllocatedColor', function (colorAllocator, topicColors) {
        return function(topicHash) {
            return topicColors[colorAllocator(topicHash)];
        };
    })
;

