
const evilNumber = 10000;
extendContent(LaunchPad, "quantum-launchpad", {
    update(tile) {
        const entity = tile.entity;
        const itemCapacity = this.itemCapacity;
        const timerLaunch = this.timerLaunch;
        const launchTime = this.launchTime;

        if (entity.cons.valid() && entity.items.total() >= itemCapacity && entity.timer.get(timerLaunch, launchTime / entity.timeScale)) {
            const items = Vars.content.items();
            for (var i = 0; i < items.size; i++) {
                var item = items.get(i);
                Events.fire(EventType.Trigger.itemLaunch);
                Effects.effect(Fx.padlaunch, tile);
                var used = Math.min(entity.items.get(item), itemCapacity);
                Vars.data.addItem(item, used * evilNumber);
                entity.items.remove(item, used);
                Events.fire(new EventType.LaunchItemEvent(item, used * evilNumber));
            }
        }
    },
    // handleDamage(tile, amount) { return 0; },
    // handleBulletHit(entity, bullet) { },
});
