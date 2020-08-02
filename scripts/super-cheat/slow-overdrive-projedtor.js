
const healed = new IntSet();
extendContent(OverdriveProjector, "slow-overdrive-projector-01", {

    update(tile) {

        const tilesize = Vars.tilesize;
        const world = Vars.world;
        const range = this.range;
        const reload = this.reload;
        const speedBoost = this.speedBoost;

        var realRange = range;
        var realBoost = speedBoost;

        var tileRange = (realRange / tilesize + 1);
        healed.clear();

        for (var x = -tileRange + tile.x; x <= tileRange + tile.x; x++) {
            for (var y = -tileRange + tile.y; y <= tileRange + tile.y; y++) {
                if (!Mathf.within(x * tilesize, y * tilesize, tile.drawx(), tile.drawy(), realRange)) continue;

                var other = world.ltile(x, y);

                if (other == null) continue;

                if (!healed.contains(other.pos()) && other.entity != null) {
                    other.entity.timeScaleDuration = Math.max(other.entity.timeScaleDuration, reload + 1);
                    other.entity.timeScale = Math.min(realBoost);
                    healed.add(other.pos());
                }
            }
        }
    },
    // handleDamage(tile, amount) { return 0; },
    // handleBulletHit(entity, bullet) { },
});

extendContent(OverdriveProjector, "slow-overdrive-projector-05", {

    update(tile) {

        const tilesize = Vars.tilesize;
        const world = Vars.world;
        const range = this.range;
        const reload = this.reload;
        const speedBoost = this.speedBoost;

        var realRange = range;
        var realBoost = speedBoost;

        var tileRange = (realRange / tilesize + 1);
        healed.clear();

        for (var x = -tileRange + tile.x; x <= tileRange + tile.x; x++) {
            for (var y = -tileRange + tile.y; y <= tileRange + tile.y; y++) {
                if (!Mathf.within(x * tilesize, y * tilesize, tile.drawx(), tile.drawy(), realRange)) continue;

                var other = world.ltile(x, y);

                if (other == null) continue;

                if (!healed.contains(other.pos()) && other.entity != null) {
                    other.entity.timeScaleDuration = Math.max(other.entity.timeScaleDuration, reload + 1);
                    other.entity.timeScale = Math.min(realBoost);
                    healed.add(other.pos());
                }
            }
        }
    },
    // handleDamage(tile, amount) { return 0; },
    // handleBulletHit(entity, bullet) { },
});
