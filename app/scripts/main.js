/* jslint browser: true, loopfunc: true */
/* globals Phaser: true, _: true */

'use strict';

var CELL_WIDTH         = 50;
var CELL_HEIGHT        = 55;
var CELL_SPACE         = 4;
var ROW_COUNT          = 8;
var COLUMN_COUNT       = 8;
var CELL_WIDTH_SPACED  = CELL_WIDTH + CELL_SPACE;
var CELL_HEIGHT_SPACED = CELL_HEIGHT + CELL_SPACE;
var BOARD_WIDTH        = CELL_WIDTH_SPACED * COLUMN_COUNT + CELL_SPACE;
var BOARD_HEIGHT       = CELL_HEIGHT_SPACED * ROW_COUNT + CELL_SPACE;
var gemNames           = ['gemred.png', 'gemblue.png', 'gemgreen.png', 'gemgold.png', 'gempurple.png', 'gemblack.png'];

var game  = new Phaser.Game(BOARD_WIDTH, BOARD_HEIGHT, Phaser.CANVAS, 'game');
var gems = [];
var swapList = [];
var matchesList = [];
var killedGems = [];
var emptyCells = [];
var movedGems = [];
var inputAllowed = false;

function swapGems () {
    var tempx = swapList[1].point.x;
    var tempy = swapList[1].point.y;
    swapList[0].moveTo(tempx, tempy, {
        duration: 300,
        easing: 'linear'
    });
    swapList[1].moveTo(swapList[0].point.x, swapList[0].point.y, {
        duration: 300,
        easing: 'linear'
    });
}

function uid (x, y) {
    return x + '' + y;
}

function selectGem (gem) {
    //console.log(gem.type, gem.point);
    if (inputAllowed) {
        if (swapList.length === 0) {
            swapList.push(gem);
            game.add.tween(gem).to({ alpha: 0.5 }, 250, Phaser.Easing.Linear.None, true);
        } else {
            swapList[0].alpha = 1;
            if (swapList[0] === gem || gems.notAdjacent(swapList[0], gem)) {
                swapList = [];
                return;
            }
            swapList.push(gem);
        }
    }
}

_.extend(Phaser.Group.prototype, {
    map: {
        north: { x: 0, y: -1 },
        south: { x: 0, y: 1 },
        east: { x: 1, y: 0 },
        west: { x: -1, y: 0 },
    },
    getSprite: function (x, y) {
        return _.find(this.children, function (sprite) {
            return sprite.point.x === x && sprite.point.y === y;
        });
    },
    getAdjacent: function _getAdjacent (gem, dir) {
        function correctGem (refGem, targetGem, dir) {
            var inline;
            if (!targetGem) { return false; }
            if (dir === 'north' || dir === 'south') {
                inline = refGem.x === targetGem.x;
            } else {
                inline = refGem.y === targetGem.y;
            }
            return targetGem && inline && refGem.type === targetGem.type;
        }
        var res = [gem];

        if (gem.y >= 0) {
            var searchX = gem.point.x + this.map[dir].x;
            var searchY = gem.point.y + this.map[dir].y;
            var nextGem = this.getSprite(searchX, searchY);
            if (correctGem(gem, nextGem, dir)) {
                res.push(nextGem);
                res = res.concat(_getAdjacent.call(this, nextGem, dir));
            }
        }
        return _.uniq(res, function (r) { return r.uid; });
    },
    spawnGemOnColumnTail: function (refGem) {
        var pointy = _.chain(this.children).select(function (gem) {
            return gem.point.x === refGem.point.x;
        }).sortBy(function (gem) {
            return gem.point.y;
        }).value()[0].point.y;
        pointy -= 1;
        var type = _.sample(gemNames);
        var newGem = this.create(refGem.x, -(BOARD_HEIGHT), type);
        newGem.point = { x: refGem.point.x, y: pointy };
        newGem.uid = uid(newGem.point.x, newGem.point.y);
        newGem.type = type;
        newGem.inputEnabled = true;
        newGem.events.onInputDown.add(selectGem);
        newGem.reset(newGem.translateX(newGem.point.x), newGem.translateY(newGem.point.y));
        newGem.isSettled = true;
    },
    notAdjacent: function (refGem, checkedGem) {
        var northGem = this.getSprite(refGem.point.x, refGem.point.y - 1);
        var southGem = this.getSprite(refGem.point.x, refGem.point.y + 1);
        var westGem  = this.getSprite(refGem.point.x - 1, refGem.point.y);
        var eastGem  = this.getSprite(refGem.point.x + 1, refGem.point.y);
        return !_.chain([northGem, southGem, westGem, eastGem]).compact().include(checkedGem).value();
    }
});

_.extend(Phaser.Sprite.prototype, {
    translateX: function (x) {
        return x * CELL_WIDTH_SPACED + CELL_SPACE;
    },
    translateY: function (y) {
        return y * CELL_HEIGHT_SPACED + CELL_SPACE;
    },
    updateCurrentPoint: function () {
        var pointx = Math.floor((this.x - CELL_SPACE) / CELL_WIDTH_SPACED);
        var pointy = Math.floor((this.y - CELL_SPACE) / CELL_HEIGHT_SPACED);
        this.uid    = uid(pointx, pointy);
        this.point = { x: pointx, y: pointy };
    },
    moveTo: function (x, y, options) {
        var easingMap = {
            linear: Phaser.Easing.Linear.None,
            bounceOut: Phaser.Easing.Bounce.Out
        };
        options = options || {};
        var easing = options.easing || 'bounceOut';
        var duration = options.duration || 400;
        var tween = game.add.tween(this);
        this.isSettled = false;

        tween.to({ x: this.translateX(x), y: this.translateY(y) }, duration, easingMap[easing]);
        tween.onStart.add(function () {
        }, this);
        tween.onComplete.add(function () {
            this.updateCurrentPoint();
            this.isSettled = true;
        }, this);
        tween.start();
    },
    moveDown: function (distance) {
        var y = this.point.y + distance;
        this.moveTo(this.point.x, y);
    },
});

var state = {
    preload: function () {
        game.stage.backgroundColor = '#71c5cf';
        _.each(gemNames, function (name) {
            game.load.image(name, '/images/'+name);
        }, this);
    },

    create: function () {
        game.physics.startSystem(Phaser.Physics.ARCADE);
        gems = game.add.group();
        gems.enableBody = true;

        var gemType, northGems, westGems, tmpx, tmpy, tmpGem, tempuid;
        for (var y = 0; y < ROW_COUNT; y++) {
            for (var x = 0; x < COLUMN_COUNT; x++) {
                tmpx    = x * CELL_WIDTH_SPACED + CELL_SPACE;
                tmpy    = y * CELL_HEIGHT_SPACED + CELL_SPACE;
                do {
                    tempuid         = uid(x, y);
                    gemType     = _.sample(gemNames);
                    tmpGem      = { x: tmpx, y: tmpy, type: gemType, uid: tempuid, point: { x: x, y: y } };
                    northGems   = gems.getAdjacent(tmpGem, 'north');
                    westGems    = gems.getAdjacent(tmpGem, 'west');
                } while(northGems.length > 2 || westGems.length > 2);

                var sprite      = gems.create(tmpx, tmpy, gemType);
                sprite.type     = gemType;
                sprite.point    = { x: x, y: y };
                sprite.uid       = tempuid;
                sprite.inputEnabled = true;
                sprite.events.onInputDown.add(selectGem);
            }
        }
        gems.forEach(function (gem) {
            var tween = game.add.tween(gem);
            tween.from({y: gem.y-BOARD_HEIGHT}, 500, Phaser.Easing.Bounce.Out);
            tween.onComplete.add(function () {
                gem.isSettled = true;
            });
            tween.start();
        });
    },

    update: function () {
        if (this.gemsIsFixed()) {
            if (inputAllowed) {
                if (swapList.length === 2) {
                    swapGems();
                    inputAllowed = false;
                }
            } else {
                if (this.getEmptyCells().length) {
                    this.bringDownGems();
                } else {
                    this.findMatches();
                    if (this.matchesFound()) {
                        this.markMatchesForRemoval();
                        this.removeMatches();
                    } else {
                        if (swapList.length === 2) {
                            swapGems();
                            swapList = [];
                        }
                        inputAllowed = true;
                    }
                }
            }
        }
    },
    gemsIsFixed: function () {
        return _.all(gems.children, function (gem) {
            return gem.isSettled;
        });
    },
    findMatches: function () {
        var group = gems;
        group.forEachAlive(function (gem) {
            _(['north', 'south', 'east', 'west']).each(function (dir) {
                var matches = group.getAdjacent(gem, dir);
                if (matches.length > 2) { matchesList.push(matches); }
            });
        });
    },
    matchesFound: function () {
        matchesList = _.chain(matchesList).flatten().compact().uniq(function (gem) {
            return gem.uid;
        }).value();
        return matchesList.length > 0;
    },
    markMatchesForRemoval: function () {
        while (matchesList.length) {
            var gem = matchesList.shift();
            killedGems.push(gem);
            // create replacement gem and place it offscreen
            gems.spawnGemOnColumnTail(gem);
        }
        swapList = [];
    },
    removeMatches: function () {
        while (killedGems.length > 0) {
            var gem = killedGems.shift();
            (function (sprite) {
                emptyCells.push({ x: sprite.point.x, y: sprite.point.y });
                var tween = game.add.tween(sprite);
                tween.to({ alpha: 0 }, 250, Phaser.Easing.Linear.None);
                tween.onComplete.add(function () {
                    sprite.destroy();
                });
                tween.start();
            })(gem);
        }
    },
    getEmptyCells: function () {
        var empties = [];
        for (var y = ROW_COUNT-1; y >= 0; y--) {
            for (var x = COLUMN_COUNT-1; x >= 0; x--) {
                var gem = gems.getSprite(x, y);
                if (!gem) { empties.push({x: x, y: y}); }
            }
        }
        return empties;
    },
    bringDownGems: function () {
        this.calculateMoveDistance();
        while (movedGems.length) {
            var obj = movedGems.pop();
            obj.gem.moveDown(obj.distance);
        }
    },
    calculateMoveDistance: function () {
        for (var x = COLUMN_COUNT-1; x >= 0; x--) {
            var distance = 0;
            var gem;
            for (var y = ROW_COUNT-1; y >= 0; y--) {
                gem = gems.getSprite(x, y);
                if (gem) {
                    if (distance > 0) {
                        movedGems.push({gem: gem, distance: distance});
                    }
                } else {
                    distance++;
                }
            }
            _.chain(gems.children).select(function (gem) {
                return gem.point.x === x && gem.point.y < 0;
            }).each(function (gem) {
                movedGems.push({gem: gem, distance: distance});
            }).value();
        }
    }
};

game.state.add('main', state);
game.state.start('main');
