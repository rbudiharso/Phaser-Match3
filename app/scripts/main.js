/* jshint browser: true */
/* global Phaser: true */
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
    var swappedGem = [];

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

    function gemX(x) {
        return (x - GEM_SPACE) / GEM_WIDTH_SPACED;
    }

    function gemY(y) {
        return (y - GEM_SPACE) / GEM_HEIGHT_SPACED;
    }

    function randomGem () {
        return sample(['gemred', 'gemblue', 'gemgreen']);
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
                    northGems = this.adjacent(x, y, klass, 'north');
                    westGems = this.adjacent(x, y, klass, 'west');
                } while (northGems >= 2 || westGems >= 2);
                gem = this.gems.create(boardX(x), boardY(y), klass);
                gem.klass = klass;
                gem.inputEnabled = true;
                gem.events.onInputDown.add(this.selectGem.bind(this));
            }, this);
        },

        update: function () {
            if (swappedGem.length === 2) {
                var equalCounts = [];
                var gemsInRows = [];
                var gemsInColumns = [];

                // swap gems
                var sourceX = swappedGem[0].x;
                var sourceY = swappedGem[0].y;
                swappedGem[0].x = swappedGem[1].x;
                swappedGem[0].y = swappedGem[1].y;
                swappedGem[1].x = sourceX;
                swappedGem[1].y = sourceY;
                swappedGem.forEach(function (gem) {
                    var _gemInRows = [gem];
                    var _gemInColumns = [gem];
                    var westSideGemsCount = this.adjacent(gemX(gem.x), gemY(gem.y), gem.klass, 'west', function (gem) {
                        _gemInRows.push(gem);
                    });
                    var eastSideGemsCount = this.adjacent(gemX(gem.x), gemY(gem.y), gem.klass, 'east', function (gem) {
                        _gemInRows.push(gem);
                    });
                    var northSideGemsCount = this.adjacent(gemX(gem.x), gemY(gem.y), gem.klass, 'north', function (gem) {
                        _gemInColumns.push(gem);
                    });
                    var southSideGemsCount = this.adjacent(gemX(gem.x), gemY(gem.y), gem.klass, 'south', function (gem) {
                        _gemInColumns.push(gem);
                    });

                    gemsInRows.push(_gemInRows);
                    gemsInColumns.push(_gemInColumns);

                    equalCounts.push(1 + westSideGemsCount.length + eastSideGemsCount.length);
                    equalCounts.push(1 + northSideGemsCount.length + southSideGemsCount.length);
                }.bind(this));

                // return gem to its original position if no available match found
                if (Math.max.apply(null, equalCounts) < 3) {
                    sourceX = swappedGem[0].x;
                    sourceY = swappedGem[0].y;
                    swappedGem[0].x = swappedGem[1].x;
                    swappedGem[0].y = swappedGem[1].y;
                    swappedGem[1].x = sourceX;
                    swappedGem[1].y = sourceY;
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

                swappedGem = [];
            }
        },

        restartGame: function () {
            game.state.start('main');
        },

        gemAt: function (x, y) {
            var _gem;
            this.gems.forEach(function (gem) {
                if (gem.x === boardX(x) && gem.y === boardY(y)) {
                    _gem = gem;
                }
            });
            return _gem;
        },

        adjacent: function _adjacent(x, y, klass, dir, callback) {
            var value = 0;
            var map = {
                north: { x: 0, y: -1 },
                south: { x: 0, y: 1 },
                east: { x: 1, y: 0 },
                west: { x: -1, y: 0 },
            };
            if (x <= 0 && y <= 0) { return value; }
            var gem = this.gemAt((x + map[dir].x), (y + map[dir].y));
            if (gem && klass === gem.klass) {
                value += 1;
                if (typeof callback === 'function') {
                    callback.call(null, gem);
                }
                value += _adjacent.call(this, gemX(gem.x), gemY(gem.y), klass, dir, callback);
            }
            return value;
        },

        selectGem: function (gem) {
            if (!swappedGem[0]) {
                swappedGem[0] = gem;
            } else {
                swappedGem[1] = gem;
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
