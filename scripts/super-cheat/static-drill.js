var lib = require('super-cheat/lib');

const block = extend(Drill, "static-drill", {});
lib.setBuildingSimple(block, Drill.DrillBuild, {
    dump(item) {
        if (item) {
            for (var i = 36; i > 0; i--) {
                this.super$dump(item);
            }
        }
    },
});
