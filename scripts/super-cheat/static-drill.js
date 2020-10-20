var lib = require('super-cheat/lib');

const block = extendContent(Drill, "static-drill", {
    displayBars(tile, table){
        const entity = tile.ent();
        if (entity.timeScale > 1) {
            entity.timeScale = 1;
        }
        this.super$displayBars(tile, table);
    },
});
lib.setBuildingSimple(block, Drill.DrillBuild, {
    timeScale() { return 1; },
    dump(item) {
        if (item) {
            for (var i = 36; i > 0; i--) {
                this.super$dump(item);
            }
        }
    },
});
