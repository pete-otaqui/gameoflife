(function(window, document, undefined) {'use strict';

    var GOL, GOLProto, Cell, CellProto, CellList, CellListProto,
        noop = function(){},
        Deferred;


    Deferred = function() {
        var dones = [], fails = [], progresses = [],
            api = {}, resolved = false, rejected = false;

        api.resolve = function(value) {
            resolved = true;
            dones.forEach(function(done) {
                done(value);
            });
        };

        api.reject = function(value) {
            rejected = true;
            fails.forEach(function(done) {
                done(value);
            });
        };

        api.update = function(value) {
            progresses.forEach(function(cb) {
                cb(value);
            });
        };

        api.promise = {
            done: function(cb) {
                if ( !resolved ) {
                    dones.push(cb);
                } else {
                    cb();
                }
            },
            fail: function(cb) {
                if ( !rejected ) {
                    fails.push(cb);
                } else {
                    cb();
                }
            },
            progress: function(cb) {
                progresses.push(cb);
            }
        };

        return api;
    };

    GOL = function() {
        this.cells = {};
        this.viewports = [];
    };
    GOLProto = GOL.prototype;

    GOLProto.seedArea = function(ox, oy, w, h, seedFunction) {
        var probability, x, y, xmax, ymax;
        if ( typeof seedFunction === 'number' ) {
            probability = seedFunction;
            seedFunction = function() {
                return (Math.random() < probability);
            };
        }
        for ( x=ox, xmax=ox+w; x<xmax; x++ ) {
            for ( y=oy, ymax=oy+h; y<ymax; y++ ) {
                if ( seedFunction(x, y) ) {
                    this.setState(x, y, true);
                }
            }
        }
    };

    GOLProto.getViewport = function(ox, oy, w, h) {
        var deferred = new Deferred();
        this.viewports.push({
            ox: ox,
            oy: oy,
            w: w,
            h: h,
            deferred: deferred
        });
        return deferred.promise;
    };

    GOLProto.advance = function() {
        var gol = this;
        this.calculateNextGeneration();
        //console.log(this.cells[0], this.cells[1], this.cells[2], this.cells[3], this.cells[4]);
        this.applyNextGeneration();
        this.viewports.forEach(function(vp) {
            var x, y, xmax = vp.ox+vp.w, ymax = vp.oy+vp.h, grid = [],
                row,
                oy = vp.oy, ox = vp.ox;
            for ( y=oy; y<ymax; y++ ) {
                row = [];
                for ( x=ox; x<xmax; x++ ) {
                    row[x-ox] = gol.getState(x, y);
                    //row[x-ox] = false;
                }
                 grid[y-oy] = row;
            }
            vp.deferred.update(grid);
        });
    };

    GOLProto.getState = function(x, y) {
        if ( !this.cells[x] ) return null;
        if ( !this.cells[x][y] ) return null;
        return this.cells[x][y].state;
    };

    GOLProto.setState = function(x, y, state) {
        //console.log('setting state', x, y, state);
        if ( !this.cells[x] ) {
            //console.log('adding row');
            this.cells[x] = {};
        }
        if ( !this.cells[x][y] ) {
            //console.log('constructing cell');
            this.cells[x][y] = new Cell(x, y, state);
        } else {
            //console.log('setting state');
            this.cells[x][y].state = state;
        }
        //console.log('returning', this.cells[x][y]);
        return this.cells[x][y];
    };

    GOLProto.calculateNextGeneration = function() {
        var x, y, living_neighbours, gol = this, new_cell;
        function addNeighbour(x, y, state) {
            var neighbour_living_neighbours;
            if ( !state ) {
                new_cell = gol.setState(x, y, false);
                // note the bit of semi-recursion here to add a cell for any non
                // living neighbours, so we can calculate whether they should come alive
                neighbour_living_neighbours = gol.countLivingNeighbours(x, y);
                new_cell.calculateNextGeneration(neighbour_living_neighbours);
            }
        }
        for ( x in this.cells ) {
            for ( y in this.cells[x] ) {
                living_neighbours = this.countLivingNeighbours(x, y, addNeighbour);
                this.cells[x][y].calculateNextGeneration(living_neighbours);
            }
        }
    };

    GOLProto.applyNextGeneration = function() {
        var x, y, cell;
        for ( x in this.cells ) {
            for ( y in this.cells[x] ) {
                cell = this.cells[x][y];
                if ( cell.next_state ) {
                    cell.state = cell.next_state;
                    cell.next_state = null;
                } else {
                    // should also check for empty rows
                    delete this.cells[x][y];
                }
            }
            // the empty row check should be here,
            // outside of the inner loop
            if ( Object.keys(this.cells[x]).length === 0 ) {
                delete this.cells[x];
            }
        }
    };


    GOLProto.countLivingNeighbours = function(x, y, callback) {
        var coord_list = this.getNeighbourCoordinates(x, y),
            gol = this,
            living_neighbours = 0,
            alive;
        if ( typeof callback !== 'function' ) callback = noop;
        coord_list.forEach(function(coords) {
            alive = gol.isAlive(coords[0], coords[1]);
            if ( alive ) {
                living_neighbours++;
            }
            callback(coords[0], coords[1], alive);
        });
        return living_neighbours;
    };

    GOLProto.getNeighbourCoordinates = function(x, y) {
        var coords = [];
        x = parseInt(x, 10);
        y = parseInt(y, 10);
        coords.push([x-1, y-1]);
        coords.push([x, y-1]);
        coords.push([x+1, y-1]);
        coords.push([x-1, y]);
        coords.push([x+1, y]);
        coords.push([x-1, y+1]);
        coords.push([x, y+1]);
        coords.push([x+1, y+1]);
        return coords;
    };

    GOLProto.isAlive = function(x, y) {
        if ( this.cells[x] ) {
            if ( this.cells[x][y] ) {
                //console.log(x, y, 'is alive');
                return this.cells[x][y].state;
            }
        }
        //console.log(x, y, 'is not alive');
        return false;
    };

    Cell = function(x, y, state) {
        this.x = x;
        this.y = y;
        this.state = state;
        this.next_state = null;
    };

    CellProto = Cell.prototype;

    CellProto.calculateNextGeneration = function(living_neighbours) {
        if ( this.next_state !== null ) return;
        switch (living_neighbours) {
            case 2:
                this.next_state = (this.state);
                break;
            case 3:
                this.next_state = true;
                break;
            default:
                this.next_state = false;
        }
    };




    window.GameOfLife = GOL;

})(this, this.document);