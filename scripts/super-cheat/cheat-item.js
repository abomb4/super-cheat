extendContent(ItemSource, 'cheat-item', {
    tryDump(tile, item) {
        if (item) {
            tile.ent().items.set(item, 90000);
            for (var i = 36; i > 0; i--) {
                this.super$tryDump(tile, item);
            }
        }
    },
    // handleDamage(tile, amount) { return 0; },
    // handleBulletHit(entity, bullet) { },
});

extendContent(LiquidSource, 'cheat-liquid', {
    tryDump(tile, item) {
        if (item) {
            tile.ent().items.set(item, 90000);
            for (var i = 36; i > 0; i--) {
                this.super$tryDump(tile, item);
            }
        }
    },
    // handleDamage(tile, amount) { return 0; },
    // handleBulletHit(entity, bullet) { },
});

extendContent(PowerSource, 'cheat-power', {
    // handleDamage(tile, amount) { return 0; },
    // handleBulletHit(entity, bullet) { },
    getPowerProduction(tile) {
        return 10000000;
    }
});
