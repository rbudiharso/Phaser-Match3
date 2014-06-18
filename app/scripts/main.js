/* jshint browser: true */
/* global Phaser: true, _: true */
'use strict';

(function () {
    var GEM_WIDTH = 50;
    var GEM_HEIGHT = 55;
    var GEM_SPACE = 2;
    var GEM_WIDTH_SPACED = GEM_WIDTH + GEM_SPACE;
    var GEM_HEIGHT_SPACED = GEM_HEIGHT + GEM_SPACE;
    var BOARD_COL = 10;
    var BOARD_ROW = 10;
    var BOARD_WIDTH = GEM_WIDTH_SPACED * BOARD_COL + GEM_SPACE;
    var BOARD_HEIGHT = GEM_HEIGHT_SPACED * BOARD_ROW + GEM_SPACE;
    var MAP = {
        north: { x: 0, y: -1 },
        south: { x: 0, y: 1 },
        east: { x: 1, y: 0 },
        west: { x: -1, y: 0 },
    };

    var game = new Phaser.Game(BOARD_WIDTH, BOARD_HEIGHT, Phaser.CANVAS, 'game');
    var mainState = {};
    var gems;
    var gemToBeSwapped = [];
    var cells = [];
    var matchesCount = [];
    var blankColumns = [];
    var refilledCells = [];
    var movingGems = [];
    var killedGems = [];
    var inputBlocked = true;
    var gamePaused = true;

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

    function coordToGrid(x, y) {
        return {
            x: Math.round(x / GEM_WIDTH_SPACED),
            y: Math.round(y / GEM_HEIGHT_SPACED)
        };
    }

    function randomGem () {
        return sample(['gemred', 'gemblue', 'gemgreen', 'gemgold', 'gempurple', 'gemblack']);
    }

    function moveGemTo (gem, x, y, callback) {
        movingGems.push(gem);
        var tween = game.add.tween(gem);
        tween.to({x: boardX(x), y: boardY(y)}, 300, Phaser.Easing.Linear.None);
        tween.onComplete.add(function () {
            movingGems.splice(movingGems.indexOf(gem), 1);
        });
        if (typeof callback === 'function') {
            tween.onComplete.add(callback, gem);
        }
        tween.start();
    }

    function moveGemsDown (gems) {
        fixGemPos(gems);
        while (blankColumns.length) {
            var obj = blankColumns.pop();
            gems.forEachAlive(function (gem) {
                if (gem.gridPos.x === obj.columnIndex && gem.gridPos.y < obj.rowIndex) {
                    var destY = gem.gridPos.y + obj.count;
                    if (destY > BOARD_ROW) {
                        console.log('wooooo', destY, obj.rowIndex, gem.gridPos.y, obj.count);
                        //moveGemTo(gem, gem.gridPos.x, destY);
                    } else {
                        moveGemTo(gem, gem.gridPos.x, destY);
                    }
                }
            });
        }
    }

    function getGemAt (gems, x, y) {
        if (x < 0 || x >= BOARD_COL || y < 0 || y >= BOARD_ROW) { return null; }
        var _gem;
        gems.forEach(function (gem) {
            if (x === gem.gridPos.x && y === gem.gridPos.y) {
                _gem = gem;
            }
        });
        return _gem;
    }
    window.getGemAt = getGemAt;

    function countAdjacent (gem, klass, dir, callback) {
        var value = 0;
        // TODO variable `gems` is global!
        var aGem = getGemAt(gems, (gem.gridPos.x + MAP[dir].x), (gem.gridPos.y + MAP[dir].y));

        if (aGem && klass === aGem.klass) {
            value = 1;
            value += countAdjacent.call(null, aGem, klass, dir, callback);
            if (typeof callback === 'function') {
                callback.call(null, aGem);
            }
        }
        return value;
    }
    window.countAdjacent = countAdjacent;

    function countMatchedAdjacent (gem) {
        var gemsInRow = [gem];
        var gemsInColumn = [gem];

        function pushGemInRows (g) { gemsInRow.push(g); }
        function pushGemInColumns (g) { gemsInColumn.push(g); }

        var eastSideGemsCount = countAdjacent(gem, gem.klass, 'east', pushGemInRows);
        var westSideGemsCount = countAdjacent(gem, gem.klass, 'west', pushGemInRows);
        var northSideGemsCount = countAdjacent(gem, gem.klass, 'north', pushGemInColumns);
        var southSideGemsCount = countAdjacent(gem, gem.klass, 'south', pushGemInColumns);

        gemsInRow = gemsInRow.sort(function (a, b) {
            return a.gridPos.x < b.gridPos.x ? -1 : a.gridPos.x > b.gridPos.x ? 1 : 0;
        });

        gemsInColumn = gemsInColumn.sort(function (a, b) {
            return a.gridPos.y < b.gridPos.y ? -1 : a.gridPos.y > b.gridPos.y ? 1 : 0;
        });

        var rows = 1 + westSideGemsCount + eastSideGemsCount;
        var columns = 1 + northSideGemsCount + southSideGemsCount;
        var uid = _.map((rows > columns ? gemsInRow : gemsInColumn), function (gem) {
            return gem.uid();
        }).join('');

        var res = { rows: rows, columns: columns, gemsInRow: gemsInRow, gemsInColumn: gemsInColumn, uid: uid };
        return res;
    }
    window.countMatchedAdjacent = countMatchedAdjacent;
    window.matchesCount = matchesCount;

    function killIsPossible () {
        return matchesCount.length > 0;
    }

    function swapGems () {
        gemToBeSwapped.forEach(function (gem) {
            moveGemTo(gem.gem, gem.destX, gem.destY);
        });
    }

    function revertGems () {
        var temp = gemToBeSwapped[0].gem;
        gemToBeSwapped[0].gem = gemToBeSwapped[1].gem;
        gemToBeSwapped[1].gem = temp;
        swapGems();
        gemToBeSwapped = [];
    }

    function resetGameState () {
        gemToBeSwapped = [];
        matchesCount = [];
    }

    function checkCollisions (gems) {
        console.log('check collision', 'moving gems', movingGems.length);
        gems.forEachAlive(function (gem) {
            var obj = countMatchedAdjacent(gem);
            if (obj.rows > 2 || obj.columns > 2) {
                matchesCount.push(obj);
            }
        });
        matchesCount = _.uniq(matchesCount, function (obj) {
            return obj.uid;
        });
    }
    window.cc = checkCollisions;

    function getBlankColumnStore (columnIndex, rowIndex) {
        var store = _.find(blankColumns, function (obj) {
            return obj && obj.columnIndex === columnIndex ;
        });
        if (!store) {
            store = { columnIndex: columnIndex, rowIndex: rowIndex, count: 0 };
            blankColumns.push(store);
        }
        if (store.rowIndex < rowIndex) {
            store.rowIndex = rowIndex;
        }
        return store;
    }

    function storeBlankColumn(columnIndex, rowIndex) {
        var blankColumn = getBlankColumnStore(columnIndex, rowIndex);
        blankColumn.count += 1;
    }

    function killGem (gem) {
        movingGems.push(gem);
        var tween = game.add.tween(gem);
        tween.to({ alpha: 0 }, 100, Phaser.Easing.Linear.None);
        tween.onComplete.add(function () {
            killedGems.push(gem);
            gem.kill();
            movingGems.splice(movingGems.indexOf(gem), 1);
        });
        tween.start();
    }

    function killGems () {
        while (matchesCount.length){
            var obj = matchesCount.pop();
            if (obj.gemsInColumn.length > 2) {
                _.each(obj.gemsInColumn, function (gem) {
                    killGem(gem);
                });
            }
            if (obj.gemsInRow.length > 2) {
                _.each(obj.gemsInRow, function (gem) {
                    killGem(gem);
                });
            }
        }
        resetGameState();
    }
    window.killGems = killGems;

    function refillBoard(gems) {
        while (refilledCells.length) {
            var cell = refilledCells.pop();
            var gem = gems.getFirstDead();
            if (gem) {
                var newKlass = randomGem();
                gem.loadTexture(newKlass);
                gem.klass = newKlass;
                gem.alpha = 1;
                gem.body.collideWorldBounds = false;
                gem.reset(boardX(cell.x), boardY(cell.y));
                gem.gridPos = { x: cell.x, y: cell.y };
                movingGems.push(gem);
                var tween = game.add.tween(gem);
                tween.from({y: -(gem.y + game.world.height)}, 300, Phaser.Easing.Linear.None);
                tween.onComplete.add(function () {
                    gem.body.collideWorldBounds = true;
                    movingGems.splice(movingGems.indexOf(gem), 1);
                });
                tween.start();
            }
        }
    }

    function fixGemPos (gems) {
        gems.forEach(function (gem) {
            var gridPos = coordToGrid(gem.x, gem.y);
            gem.gridPos = gridPos;
        });
    }
    window.fixGemPos = fixGemPos;

    mainState = {
        preload: function () {
            game.stage.backgroundColor = '#71c5cf';
            ['gemred', 'gemblue', 'gemgreen', 'gemgold', 'gempurple', 'gemblack'].forEach(function (name) {
                game.load.image(name, '../images/'+name+'.png');
            }.bind(this));
            game.load.image('particlwWhite', '../images/white.png');
        },

        create: function () {
            var done = 0;
            var cellsCount = BOARD_COL * BOARD_ROW;
            game.physics.startSystem(Phaser.Physics.ARCADE);

            this.gems = game.add.group();
            this.gems.enableBody = true;

            gems = this.gems;

            boardLoop(function (x, y) {
                var klass, northGems, westGems, gem;
                do {
                    klass = randomGem();
                    var _gem = { x: (x*GEM_WIDTH_SPACED), y: (y*GEM_HEIGHT_SPACED), gridPos: { x: x, y: y } };
                    northGems = countAdjacent(_gem, klass, 'north');
                    westGems = countAdjacent(_gem, klass, 'west');
                } while (northGems >= 2 || westGems >= 2);

                gem = this.gems.create(boardX(x), boardY(y), klass);
                gem.gridPos = { x: x, y: y };
                gem.klass = klass;
                gem.inputEnabled = true;
                gem.events.onInputDown.add(this.selectGem.bind(this));

                gem.uid = function () {
                    return this.gridPos.x + '' + this.gridPos.y;
                };

                if (!cells[x]) { cells[x] = []; }
                cells[x][y] = { x: boardX(x), y: boardY(y), gem: gem };

            }, this);

            this.gems.setAll('body.collideWorldBounds', true);
            this.gems.forEach(function (gem) {
                var tween = game.add.tween(gem);
                tween.from({y: (gem.y - game.world.height)}, 300, Phaser.Easing.Bounce.Out);
                tween.onComplete.add(function () {
                    done++;
                    gamePaused = (done !== cellsCount);
                });
                tween.start();
            });
            window.game = game;
            window.gems = this.gems;
        },

        update: function () {
            if (!gamePaused) {
                fixGemPos(this.gems);
                if (inputBlocked) {
                    if (!movingGems.length && killedGems.length) {
                        killedGems = _.uniq(killedGems, function (gem) {
                            return gem.uid();
                        });
                        _.each(killedGems, function (gem) {
                            storeBlankColumn(gem.gridPos.x, gem.gridPos.y);
                        });
                        _.each(blankColumns, function (obj) {
                            for (var i = 0; i < obj.count; i++) {
                                refilledCells.push({ x: obj.columnIndex, y: i });
                            }
                        });
                        killedGems = [];
                    }
                    if (!movingGems.length && !killedGems.length) {
                        moveGemsDown(this.gems);
                    }
                    if (!movingGems.length && !killedGems.length) {
                        refillBoard(this.gems);
                    }
                    if (!movingGems.length && !killedGems.length) {
                        checkCollisions(this.gems);
                        if (killIsPossible()) {
                            killGems();
                        } else {
                            inputBlocked = false;
                        }
                    }
                } else {
                    if (!movingGems.length && gemToBeSwapped.length === 2) {
                        revertGems();
                    }
                }
            }
        },

        restartGame: function () {
            game.state.start('main');
        },

        selectGem: function (gem) {
            if (!inputBlocked) {
                if (!gemToBeSwapped[0]) {
                    gemToBeSwapped[0] = { gem: gem };
                    game.add.tween(gem).to({alpha: 0.5}, 100, Phaser.Easing.Linear.None, true);
                } else {
                    gemToBeSwapped[0].gem.alpha = 1.0;
                    if (gem === gemToBeSwapped[0].gem) {
                        gemToBeSwapped = [];
                        return;
                    }
                    gemToBeSwapped[0].destX = gem.gridPos.x;
                    gemToBeSwapped[0].destY = gem.gridPos.y;
                    gemToBeSwapped[1] = { gem: gem };
                    gemToBeSwapped[1].destX = gemToBeSwapped[0].gem.gridPos.x;
                    gemToBeSwapped[1].destY = gemToBeSwapped[0].gem.gridPos.y;
                    inputBlocked = true;
                    swapGems();
                }
            }
        },
    };

    game.state.add('main', mainState);
    game.state.start('main');
})();
