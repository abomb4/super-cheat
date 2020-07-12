
const entityProv = prov(() => {
    return extend(Drill.DrillEntity, {
        // No effective by
        delta() {
            if (this.timeScale > 1) {
                this.timeScale = 1;
            }
            return Time.delta() * this.timeScale;
        }
    });
});
extendContent(Drill, "invincible-drill", {
    load() {
        this.super$load();
        this.entityType = entityProv;
    },
    displayBars(tile, table){
        const entity = tile.ent();
        if (entity.timeScale > 1) {
            entity.timeScale = 1;
        }
        this.super$displayBars(tile, table);
    },
    tryDump(tile, item) {
        if (item) {
            for (var i = 36; i > 0; i--) {
                this.super$tryDump(tile, item);
            }
        }
    },
    offloadNear(tile, item) {
        var entity = tile.ent();
        var count = entity.delta() / this.drillTime;
        if(entity.cons.optionalValid()){
            count = count * this.liquidBoostIntensity;
        }
        for (var i = 0; i < count; i++) {
            this.super$offloadNear(tile, item);
        }
    },
    handleDamage(tile, amount) { return 0; },
    handleBulletHit(entity, bullet) { },
});
