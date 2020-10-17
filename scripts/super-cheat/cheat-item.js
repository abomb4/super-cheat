var lib = require('super-cheat/lib');

var itemSource = extendContent(ItemSource, 'cheat-item', {});
lib.setBuildingSimple(itemSource, ItemSource.ItemSourceBuild, {
    dump(todump) {
        var count = 36;
        while (count > 0 && this.super$dump(todump)) {
            count--;
        }
    },
});

var powerSource = extendContent(PowerSource, 'cheat-power', {});
lib.setBuildingSimple(powerSource, PowerSource.PowerSourceBuild, {
    getPowerProduction(tile) {
        return this.enabled ? 10000000000 : 0;
    }
});
