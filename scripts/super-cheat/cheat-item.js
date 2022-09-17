var lib = require('super-cheat/lib');

var itemSource = extend(ItemSource, 'cheat-item', {});
lib.setBuildingSimple(itemSource, ItemSource.ItemSourceBuild, {
    dump(item) {
        var count = 36;
        this.items.set(item, count);
        while (count > 0 && this.super$dump(item)) {
            count--;
        }
    },
});

var powerSource = extend(PowerSource, 'cheat-power', {});
lib.setBuildingSimple(powerSource, PowerSource.PowerSourceBuild, {
    getPowerProduction(tile) {
        return this.enabled ? 10000000000 : 0;
    }
});
