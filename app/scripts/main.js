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

    function boardLoop (callback, context) {
        for (var y = 0; y < BOARD_ROW; y ++) {
            for (var x = 0; x < BOARD_COL; x ++) {
                (function (ix, iy) {
                    var a = ix;
                    var b = iy;
                    callback.call(context, a, b, BOARD_COL, BOARD_ROW);
                })(x, y);
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

    mainState.preload = function () {
        game.stage.backgroundColor = '#71c5cf';
        ['gemred', 'gemblue', 'gemgreen'].forEach(function (name) {
            game.load.image(name, '../images/'+name+'.png');
        }.bind(this));
    };

    mainState.create = function () {
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
        }, this);
    };

    mainState.update = function () {
        game.physics.arcade.collide(this.gems, this.gems, this.stopCollided);
    };

    mainState.restartGame = function () {
        game.state.start('main');
    };

    mainState.gemAt = function (x, y) {
        var _gem;
        this.gems.forEach(function (gem) {
            if (gem.x === boardX(x) && gem.y === boardY(y)) {
                _gem = gem;
            }
        });
        return _gem;
    };

    mainState.adjacent = function _adjacent(x, y, klass, dir) {
        var value = 0;
        var map = {
            north: { x: 0, y: -1 },
            south: { x: 0, y: 1 },
            east: { x: 1, y: 0 },
            west: { x: -1, y: 0 },
        };
        if (x <= 0 && y <= 0) { return value; }
        var gem = mainState.gemAt((x + map[dir].x), (y + map[dir].y));
        if (gem && klass === gem.klass) {
            value += 1;
            value += _adjacent(gemX(gem.x), gemY(gem.y), klass, dir);
        }
        return value;
    };

    game.state.add('main', mainState);
    game.state.start('main');
})();
