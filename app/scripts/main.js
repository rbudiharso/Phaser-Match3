/* jshint browser: true */
/* global Phaser: true, _: true */
'use strict';

(function () {
    var GEM_WIDTH = 101;
    var GEM_HEIGHT = 112;
    var GEM_SPACE = 2;
    var GEM_WIDTH_SPACED = GEM_WIDTH + GEM_SPACE;
    var GEM_HEIGHT_SPACED = GEM_HEIGHT + GEM_SPACE;
    var BOARD_COL = 5;
    var BOARD_ROW = 5;
    var BOARD_WIDTH = GEM_WIDTH_SPACED * BOARD_COL + GEM_SPACE;
    var BOARD_HEIGHT = GEM_HEIGHT_SPACED * BOARD_ROW + GEM_SPACE;
    var mainState = {};
    var game = new Phaser.Game(BOARD_WIDTH, BOARD_HEIGHT, Phaser.AUTO, 'game');
    var gemToBeSwapped = [];
    var MAP = {
        north: { x: 0, y: -1 },
        south: { x: 0, y: 1 },
        east: { x: 1, y: 0 },
        west: { x: -1, y: 0 },
    };

    function boardLoop (callback, context) {
        for (var y = 0; y < BOARD_ROW; y ++) {
            for (var x = 0; x < BOARD_COL; x ++) {
                callback.call(context, x, y, BOARD_COL, BOARD_ROW);
            }
        }
    }

    function sample (array) {
        var index = Math.floor(Math.random() * array.length);
        return array[index];
    }

    function boardX (x) {
        return x * GEM_WIDTH_SPACED + GEM_SPACE;
    }

    function boardY (y) {
        return y * GEM_HEIGHT_SPACED + GEM_SPACE;
    }

    function randomGem () {
        return sample(['gemred', 'gemblue', 'gemgreen']);
    }

    function moveGemTo (gem, destX, destY, callback) {
        gem.state = 'moving';
        var tween = game.add.tween(gem).to({x: destX, y: destY}, 100, Phaser.Easing.Linear.None, true);
        tween.onComplete.add(callback, gem);
    }

    function coordToGrid(x, y) {
        return {
            x: Math.round(x / GEM_WIDTH_SPACED),
            y: Math.round(y / GEM_HEIGHT_SPACED)
        };
    }

    mainState = {
        preload: function () {
            game.stage.backgroundColor = '#71c5cf';
            ['gemred', 'gemblue', 'gemgreen'].forEach(function (name) {
                game.load.image(name, '../images/'+name+'.png');
            }.bind(this));
        },

        create: function () {
            game.physics.startSystem(Phaser.Physics.ARCADE);

            this.gems = game.add.group();
            this.gems.enableBody = true;

            boardLoop(function (x, y) {
                var klass, northGems, westGems, gem;
                do {
                    klass = randomGem();
                    northGems = this.adjacent((x*GEM_WIDTH_SPACED), (y*GEM_HEIGHT_SPACED), klass, 'north');
                    westGems = this.adjacent((x*GEM_WIDTH_SPACED), (y*GEM_HEIGHT_SPACED), klass, 'west');
                } while (northGems >= 2 || westGems >= 2);
                gem = this.gems.create(boardX(x), boardY(y), klass);
                gem.klass = klass;
                gem.inputEnabled = true;
                gem.events.onInputDown.add(this.selectGem.bind(this));
            }, this);
        },

        update: function () {
            if (gemToBeSwapped.length === 2) {

                var allReady = _.every(gemToBeSwapped, function (gem) {
                    return gem.state === 'ready' && (gem.x !== gem.destX || gem.y !== gem.destY);
                });
                if (allReady) {
                    if (gemToBeSwapped[0].reverting) {
                        gemToBeSwapped.forEach(function (gem) {
                            moveGemTo(gem, gem.destX, gem.destY, function () {
                                this.state = 'moved';
                                delete this.reverting;
                            });
                        });
                        return gemToBeSwapped = [];
                    } else {
                        gemToBeSwapped.forEach(function (gem) {
                            moveGemTo(gem, gem.destX, gem.destY, function () {
                                this.state = 'moved';
                            });
                        });
                    }
                }

                var allMoved = _.every(gemToBeSwapped, function (gem) {
                    return gem.state === 'moved' && !gem.reverting;
                });
                if (allMoved) {
                    var equalCounts = [];
                    var gemsInRows = [];
                    var gemsInColumns = [];

                    _.each(gemToBeSwapped, function (gem) {
                        var _gemInRows = [gem];
                        var _gemInColumns = [gem];
                        var westSideGemsCount = this.adjacent(gem.x, gem.y, gem.klass, 'west', function () {
                            _gemInRows.push(this);
                        });
                        var eastSideGemsCount = this.adjacent(gem.x, gem.y, gem.klass, 'east', function () {
                            _gemInRows.push(this);
                        });
                        var northSideGemsCount = this.adjacent(gem.x, gem.y, gem.klass, 'north', function () {
                            _gemInColumns.push(this);
                        });
                        var southSideGemsCount = this.adjacent(gem.x, gem.y, gem.klass, 'south', function () {
                            _gemInColumns.push(this);
                        });

                        gemsInRows.push(_gemInRows);
                        gemsInColumns.push(_gemInColumns);

                        equalCounts.push(1 + westSideGemsCount + eastSideGemsCount);
                        equalCounts.push(1 + northSideGemsCount + southSideGemsCount);
                    }, this);

                    // return gem to its original position if no available match found
                    if (gemToBeSwapped.length && Math.max.apply(null, equalCounts) < 3) {
                        gemToBeSwapped[0].state = 'ready';
                        gemToBeSwapped[0].reverting = true;
                        gemToBeSwapped[0].destX = gemToBeSwapped[1].x;
                        gemToBeSwapped[0].destY = gemToBeSwapped[1].y;
                        gemToBeSwapped[1].state = 'ready';
                        gemToBeSwapped[1].reverting = true;
                        gemToBeSwapped[1].destX = gemToBeSwapped[0].x;
                        gemToBeSwapped[1].destY = gemToBeSwapped[0].y;
                        return;
                    }

                    // remove matched gems
                    gemsInRows.forEach(function (row) {
                        if (row.length > 2) {
                            row.forEach(function (gem) { gem.kill(); });
                        }
                    });
                    gemsInColumns.forEach(function (column) {
                        if (column.length > 2) {
                            column.forEach(function (gem) { gem.kill(); });
                        }
                    });

                    gemToBeSwapped = [];
                }

            }
        },

        restartGame: function () {
            game.state.start('main');
        },

        gemAt: function (x, y) {
            var _gem;
            this.gems.forEach(function (gem) {
                var gridPos = coordToGrid(gem.x, gem.y);
                if (x === gridPos.x && y === gridPos.y) {
                    _gem = gem;
                }
            });
            return _gem;
        },

        adjacent: function _adjacent(x, y, klass, dir, callback) {
            var value = 0;
            if (x <= 0 && y <= 0) { return value; }

            var gridPos = coordToGrid(x, y);
            var gem = this.gemAt((gridPos.x + MAP[dir].x), (gridPos.y + MAP[dir].y));

            if (gem && klass === gem.klass) {
                value += 1;
                if (typeof callback === 'function') {
                    callback.call(gem);
                }
                value += _adjacent.call(this, gem.x, gem.y, klass, dir, callback);
            }
            return value;
        },

        selectGem: function (gem) {
            if (!gemToBeSwapped[0]) {
                gemToBeSwapped[0] = gem;
            } else {
                gemToBeSwapped[1] = gem;
                gemToBeSwapped[0].state = 'ready';
                gemToBeSwapped[0].destX = gemToBeSwapped[1].x;
                gemToBeSwapped[0].destY = gemToBeSwapped[1].y;
                gemToBeSwapped[1].state = 'ready';
                gemToBeSwapped[1].destX = gemToBeSwapped[0].x;
                gemToBeSwapped[1].destY = gemToBeSwapped[0].y;
            }
        },

        swapGem: function (source, destination) {
            var sourceX = source.x;
            var sourceY = source.y;
            source.x = destination.x;
            source.y = destination.y;
            destination.x = sourceX;
            destination.y = sourceY;
        }
    };

    game.state.add('main', mainState);
    game.state.start('main');
})();
