
const lib = require('super-cheat/lib')

const InvincibleForceFieldAbility = (radius, regen, max, cooldown) => {

    var realRad;
    var paramUnit;
    var paramField;
    var shieldConsumer = cons(trait => {
        if (trait.team != paramUnit.team
            && trait.type.absorbable
            && Intersector.isInsideHexagon(paramUnit.x, paramUnit.y, realRad * 2, trait.x, trait.y)
            && paramUnit.shield > 0) {

            trait.absorb();
            Fx.absorb.at(trait);

            paramField.alpha = 1;
        }
    });

    const ability = new JavaAdapter(ForceFieldAbility, {
        update(unit) {
            unit.shield = Infinity;
            this.radiusScale = Mathf.lerpDelta(this.radiusScale, 1, 0.06)
            realRad = this.radiusScale * this.radius;
            paramUnit = unit;
            paramField = this;
            Groups.bullet.intersect(unit.x - realRad, unit.y - realRad, realRad * 2, realRad * 2, shieldConsumer);
            this.alpha = Math.max(this.alpha - Time.delta / 10, 0);
        },
        copy() {
            return InvincibleForceFieldAbility(radius, regen, max, cooldown);
        },
        draw(unit) {
            this.super$draw(unit);
        },
    }, radius, regen, max, cooldown);

    return ability;
};

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
    bt.speed = 24.1;
    bt.hitSize = 5;
    bt.width = 7;
    bt.height = 35;
    bt.lifetime = 10;
    bt.inaccuracy = 0;
    bt.despawnEffect = Fx.hitBulletSmall;
    bt.keepVelocity = false;
    return bt;
})();

const invincibleWeapon = (() => {

    const w = extend(Weapon, {});

    w.name = lib.modName + '-' + 'invincible-ship-weapon';
    w.length = 1.5;
    w.reload = 7;
    // w.ejectEffect = Fx.shellEjectSmall;
    w.bullet = invincibleBulletType;
    w.rotate = true;
    w.rotateSpeed = 20;
    w.x = 3;
    w.y = 2;
    return w;
})();

const mech = (() => {
    const m = extend(UnitType, 'invincible-ship', {});

    m.abilities.add(new RepairFieldAbility(Infinity, 60, 8 * 8));
    // m.abilities.add(new JavaAdapter(ForceFieldAbility, {}, 60, Infinity, Infinity, 300));
    m.abilities.add(InvincibleForceFieldAbility(60, Infinity, Infinity, 300));
    m.constructor = prov(() => extend(UnitTypes.alpha.constructor.get().class, {
        damage(amount) { },
    }));
    m.defaultController = prov(() => new BuilderAI());

    m.weapons.add(invincibleWeapon);
    m.flying = true;
    m.speed = 120;
    m.hitSize = 12;
    m.accel = 0.01;
    m.rotateSpeed = 20;
    m.baseRotateSpeed = 20;
    // m.boostMultiplier = 3;
    // m.canBoost = false;
    m.drag = 0.1;
    m.mass = 31210;
    m.shake = 3;
    m.health = 10;
    m.mineSpeed = 50000;
    m.mineTier = 2147483647;
    m.buildSpeed = Infinity;
    m.itemCapacity = 9999;
    m.canHeal = false;
    m.engineOffset = 5;
    m.engineSize = 3;
    m.rotateShooting = false;
    m.payloadCapacity = (200 * 200) * (8 * 8);
    m.ammoCapacity = 200000000;
    m.ammoResupplyAmount = 1;
    m.commandLimit = 30;
    // m.weaponOffsetY = -2;
    // m.weaponOffsetX = 5;
    m.coreUnitDock = true;
    m.mineWalls = true;
    m.envDisabled = 0;

    return m;
})();

exports.invincibleShip = mech;
