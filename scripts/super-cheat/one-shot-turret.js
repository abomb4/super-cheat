const lib = require('super-cheat/lib');

const invincibleBulletType = (() => {

    const bt = extend(BasicBulletType, {
        hitEntity(b, other, initialHealth) {
            if (other && other.kill) {
                Call.unitDestroy(other.id)
            }
        },
        hitTile(b, tile, x, y, health, direct)  {
            this.super$hitTile(b, tile, x, y, health, direct) ;
            if (tile) {
                tile.killed()
            }
        },
    });

    bt.damage = Infinity;
    bt.splashDamage = Infinity;
    bt.speed = 24;
    bt.hitSize = 6;
    bt.width = 9;
    bt.height = 45;
    bt.lifetime = 26;
    bt.inaccuracy = 0;
    bt.despawnEffect = Fx.hitBulletSmall;
    bt.keepVelocity = false;
    return bt;
})();

const turret = extend(Turret, 'one-shot-turret', {
});

lib.setBuildingSimple(turret, Turret.TurretBuild, {
    hasAmmo() { return true; },
    peekAmmo() { return invincibleBulletType; },
    useAmmo() { return invincibleBulletType; },
    shoot(type) {
        this.super$shoot(type)
    },
});

turret.targetInterval = 0;
