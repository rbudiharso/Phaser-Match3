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
    var game = new Phaser.Game(BOARD_WIDTH, BOARD_HEIGHT, Phaser.CANVAS, 'game');
    var gems;
    var gemToBeSwapped = [];
    var lowestBlanks = [];
    var cells = [];
    var matchesCount = [];
    var checkMatches = false;
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
        var origGridPos = coordToGrid(gem.x, gem.y);
        var destGridPos = coordToGrid(destX, destY);
        var tween = game.add.tween(gem).to({x: destX, y: destY}, 200, Phaser.Easing.Linear.None);
        tween.onStart.add(function () {
            gem.state = 'moving';
            cells[origGridPos.x][origGridPos.y].gem = null;
            cells[origGridPos.x][origGridPos.y].state = 'transition';
        });
        tween.onComplete.add(function () {
            cells[origGridPos.x][origGridPos.y].state = 'ready';

            gem.state = 'ready';
            cells[destGridPos.x][destGridPos.y].gem = gem;
        });
        if (typeof callback === 'function') {
            tween.onComplete.add(callback, gem);
        }
        tween.start();
    }

    function coordToGrid(x, y) {
        return {
            x: Math.round(x / GEM_WIDTH_SPACED),
            y: Math.round(y / GEM_HEIGHT_SPACED)
        };
    }

    function getLowestBlanks (gems) {
        gems.forEachDead(function (gem) {
            if (gem.y > 0) {
                var gridPos = coordToGrid(gem.x, gem.y);
                cells[gridPos.x][gridPos.y].gem = null;
                if (!lowestBlanks[gridPos.x]) {
                    lowestBlanks[gridPos.x] = { x: gridPos.x, y: gridPos.y, colCount: 0 };
                }
                lowestBlanks[gridPos.x].colCount += 1;
                gem.y = -1 * GEM_HEIGHT_SPACED;
            }
        });
    }

    function moveGemsDown (gems) {
        while (lowestBlanks.length) {
            var pos = lowestBlanks.pop();
            if (pos) {
                gems.forEachAlive(function (gem) {
                    var gridPos = coordToGrid(gem.x, gem.y);
                    if (pos.x === gridPos.x && pos.y > gridPos.y) {
                        var destY = gem.y + (pos.colCount * GEM_HEIGHT_SPACED);
                        moveGemTo(gem, gem.x, destY);
                    }
                });
            }
        }
    }

    function getGemAt (pool, x, y) {
        var _gem;
        pool.forEach(function (gem) {
            var gridPos = coordToGrid(gem.x, gem.y);
            if (x === gridPos.x && y === gridPos.y) {
                _gem = gem;
            }
        });
        return _gem;
    }

    function countAdjacent (gem, klass, dir, callback) {
        var value = 0;
        var gridPos = coordToGrid(gem.x, gem.y);
        // TODO variable `gems` is global!
        var aGem = getGemAt(gems, (gridPos.x + MAP[dir].x), (gridPos.y + MAP[dir].y));

        if (aGem && klass === aGem.klass) {
            value = 1;
            value += countAdjacent.call(null, aGem, klass, dir, callback);
            if (typeof callback === 'function') {
                callback.call(null, aGem);
            }
        }
        return value;
    }

    function countMatchedAdjacent (gem) {
        var gemsInRow = [gem];
        var gemsInColumn = [gem];

        function pushGemInRows (g) { gemsInRow.push(g); }
        function pushGemInColumns (g) { gemsInColumn.push(g); }

        var eastSideGemsCount = countAdjacent(gem, gem.klass, 'east', pushGemInRows);
        var westSideGemsCount = countAdjacent(gem, gem.klass, 'west', pushGemInRows);
        var northSideGemsCount = countAdjacent(gem, gem.klass, 'north', pushGemInColumns);
        var southSideGemsCount = countAdjacent(gem, gem.klass, 'south', pushGemInColumns);

        var rows = 1 + westSideGemsCount + eastSideGemsCount;
        var columns = 1 + northSideGemsCount + southSideGemsCount;
        return { rows: rows, columns: columns, gemsInRow: gemsInRow, gemsInColumn: gemsInColumn };
    }

    function killIsPossible () {
        if (matchesCount.length === 0) { return false; }
        return _.some(matchesCount, function (obj) {
            return obj.rows > 2 || obj.columns > 2;
        });
    }

    function swapGems () {
        gemToBeSwapped.forEach(function (gem) {
            moveGemTo(gem.gem, gem.destX, gem.destY, function () {
                var res = countMatchedAdjacent(this);
                matchesCount.push(res);
            });
        });
        checkMatches = true;
    }

    function resetGameState () {
        gemToBeSwapped = [];
        checkMatches = false;
        matchesCount = [];
    }

    function killGems () {
        while (matchesCount.length){
            var obj = matchesCount.pop();
            if (obj.gemsInColumn.length > 2) {
                _.each(obj.gemsInColumn, function (gem) {
                    gem.kill();
                });
            }
            if (obj.gemsInRow.length > 2) {
                _.each(obj.gemsInRow, function (gem) {
                    gem.kill();
                });
            }
        }
        resetGameState();
    }

    function revertGems () {
        var temp = gemToBeSwapped[0].gem;
        gemToBeSwapped[0].gem = gemToBeSwapped[1].gem;
        gemToBeSwapped[1].gem = temp;
        gemToBeSwapped.forEach(function (gem) {
            moveGemTo(gem.gem, gem.destX, gem.destY);
        });
        resetGameState();
    }

    function gemsReady(gems) {
        var res = true;
        gems.forEachAlive(function (gem) {
            if (gem.state !== 'ready') { res = false; }
        });
        return res;
    }

    function refillBoard(gems) {
        var tweenComplete = true;
        gems.forEachAlive(function (gem) {
            if (game.tweens.isTweening(gem)) {
                tweenComplete = false;
            }
        });
        if (tweenComplete) {
            boardLoop(function (x, y) {
                var cell = cells[x][y];
                if (!cell.gem && cell.state === 'ready') {
                    var gem = gems.getFirstDead();
                    if (gem) {
                        gem.reset(cell.x, cell.y);
                        cell.gem = gem;
                    }
                }
            });
        }
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

            gems = this.gems;

            boardLoop(function (x, y) {
                var klass, northGems, westGems, gem;
                do {
                    klass = randomGem();
                    var _gem = { x: (x*GEM_WIDTH_SPACED), y: (y*GEM_HEIGHT_SPACED) };
                    northGems = countAdjacent(_gem, klass, 'north');
                    westGems = countAdjacent(_gem, klass, 'west');
                } while (northGems >= 2 || westGems >= 2);

                gem = this.gems.create(boardX(x), boardY(y), klass);
                gem.klass = klass;
                gem.inputEnabled = true;
                gem.state = 'ready';
                gem.events.onInputDown.add(this.selectGem.bind(this));

                if (!cells[x]) { cells[x] = []; }
                cells[x][y] = { x: boardX(x), y: boardY(y), gem: gem, state: 'ready' };
            }, this);

            this.gems.setAll('body.collideWorldBounds', true);
            this.gems.forEach(function (gem) {
                game.add.tween(gem).from({y: (gem.y - game.world.height)}, 600, Phaser.Easing.Bounce.Out, true);
            });
        },

        update: function () {
            refillBoard(this.gems);

            if (gemsReady(this.gems) && !checkMatches && gemToBeSwapped.length === 2 && !matchesCount.length) {
                return swapGems();
            }
            if (gemsReady(this.gems) && gemToBeSwapped.length === 2 && matchesCount.length === 2) {
                if (killIsPossible()) {
                    return killGems();
                } else {
                    return revertGems();
                }
            }
            if (gemsReady(this.gems)) {
                getLowestBlanks(this.gems);
                moveGemsDown(this.gems);
            }
        },

        restartGame: function () {
            game.state.start('main');
        },

        selectGem: function (gem) {
            if (!gemToBeSwapped[0]) {
                gemToBeSwapped[0] = { gem: gem };
            } else {
                if (gem === gemToBeSwapped[0].gem) {
                    gemToBeSwapped = [];
                    return;
                }
                gemToBeSwapped[0].destX = gem.x;
                gemToBeSwapped[0].destY = gem.y;
                gemToBeSwapped[1] = { gem: gem };
                gemToBeSwapped[1].destX = gemToBeSwapped[0].gem.x;
                gemToBeSwapped[1].destY = gemToBeSwapped[0].gem.y;
            }
        },
    };

    game.state.add('main', mainState);
    game.state.start('main');
})();
