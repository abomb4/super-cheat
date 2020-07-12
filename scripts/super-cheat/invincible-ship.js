
const lib = require('super-cheat/lib');

const globalLancerMechShield = (() => {

    const SHIELD_ID = 0;

    const map = {}
    const MAX_CHARGE = 2000;        // 最大血量
    const CHARGE_STEP = 30;         // 每次充能量，目前是发射一个子弹充多少能，散弹则乘以弹数
    const MAX_RADIUS = 48;          // 最大范围
    const MIN_RADIUS = 20;          // 最小范围
    const MAX_RADIUS_PRECENT = 0.5; // 最大范围临界血量
    const MIN_RADIUS_PERCENT = 0.2; // 最小范围临界血量
    const MIN_CHARGE_PERCENT = 0.2; // 被打爆后充能到多少才生效

    function PlayerShield(player) {
        var entity = {
            player: player,
            id: ++SHIELD_ID,
            power: MAX_CHARGE,
            broken: false,
            hit: 0,
            chargeEffectEnergy: 0,
        };
        function setPower(v) { entity.power = v; }
        function getPower() { return entity.power; }
        function setHit(v) { entity.hit = v; }
        function getHit() { return entity.hit; }
        function setChargeEffectEnergy(v) { entity.chargeEffectEnergy = v; }
        function getChargeEffectEnergy() { return entity.chargeEffectEnergy; }
        function setBroken(v) { entity.broken = v; }
        function getBroken() { return entity.broken; }

        function handleDamage(trait) {
            trait.absorb();
            Effects.effect(Fx.absorb, trait);
            // setPower(getPower() - trait.getShieldDamage())
            // if (getPower() <= 0) {
            //     setPower(0);
            //     setBroken(true);
            // }
            setHit(1);
        }
        function activeRadius() {
            if (entity.broken) { return 0; }
            var percent = getPower() / MAX_CHARGE;

            if (percent >= MAX_RADIUS_PRECENT) {
                return MAX_RADIUS;
            } else if (percent <= MIN_RADIUS_PERCENT) {
                return MIN_RADIUS;
            } else {
                return MIN_RADIUS + (percent - MIN_RADIUS_PERCENT) / (MAX_RADIUS_PRECENT - MIN_RADIUS_PERCENT) * (MAX_RADIUS - MIN_RADIUS);
            }
        }

        function charge(num) {
            if (num > 0) {
                setPower(Math.min(getPower() + CHARGE_STEP * num, MAX_CHARGE));
            }

            if (getPower() > MAX_CHARGE * MIN_CHARGE_PERCENT) {
                setBroken(false);
            }
            if (getPower() != MAX_CHARGE && !getBroken()) {
                setChargeEffectEnergy(1);
                // Effects.effect(chargeEffect, entity.player.x, entity.player.y, 0, {
                //     activeRadius: () => activeRadius()
                // });
            }
        }

        function tryAbsorb() {
            const realRadius = activeRadius();
            if (getHit() > 0) {
                setHit(getHit() - 1 / 5 * Time.delta());
            }
            if (getChargeEffectEnergy() > 0) {
                setChargeEffectEnergy(getChargeEffectEnergy() - 1 / 4 * Time.delta());
            }
            var me = entity.player;
            Vars.bulletGroup.intersect(me.x - realRadius, me.y - realRadius, realRadius * 2, realRadius * 2, cons((trait) => {
                if (trait.canBeAbsorbed()
                    && trait.getTeam() != me.getTeam()
                    && Mathf.dst(trait.getX(), trait.getY(), me.x, me.y) < realRadius) {

                    handleDamage(trait);
                }
            }));
        }

        function draw() {
            var x = entity.player.x;
            var y = entity.player.y;
            var rad = activeRadius();

            // shield
            if (getPower() == MAX_CHARGE) {
                Draw.color(Color.valueOf("ffe33f"));
            } else {
                Draw.color(Pal.accent);
            }
            Lines.stroke(1.5);
            Draw.alpha(0.09 + 0.08 * getHit());
            Fill.circle(x, y, rad);
            Draw.alpha(1);
            Lines.circle(x, y, rad);

            // hit
            Draw.color(Color.white);
            Draw.alpha(entity.hit * 0.5);
            Fill.circle(x, y, activeRadius());
            Draw.color();

            // charge
            Draw.color(Pal.heal);
            Draw.alpha(entity.chargeEffectEnergy * 0.5);
            Fill.circle(x, y, activeRadius());
            Draw.color();

            Draw.reset();
        }
        function debugDump() {
            print('id: ' + entity.id + ', power: ' + getPower() + ', hit: ' + getHit() + ', broken: ' + getBroken() + ', player: ' + entity.player);
        }
        return {
            charge: charge,
            defence() { tryAbsorb() },
            draw: draw,
            debugDump: debugDump,
        };
    }

    Events.on(EventType.MechChangeEvent, cons((v) => {
        if (v.mech == mech) {
            map[v.player.id] = new PlayerShield(v.player);
        }
    }));
    return {
        getShield(player, init) {
            if (init || map[player.id] == null) {
                map[player.id] = new PlayerShield(player);
            }
            return map[player.id];
        },
    };
})();

const invincibleBulletType = (() => {

    const bt = extend(BasicBulletType, {
        hitTile(b, tile) {
            this.super$hitTile(b, tile);
            if (tile && tile.ent()) {
                Call.onTileDestroyed(tile);
            }
        },
    });

    // bt.damage = 0;
    bt.damage = Infinity;
    bt.splashDamage = Infinity;
    bt.speed = 4;
    bt.bulletWidth = 7;
    bt.bulletHeight = 9;
    bt.lifetime = 100;
    bt.inaccuracy = 5;
    bt.despawnEffect = Fx.hitBulletSmall;
    return bt;
})();

const invincibleWeapon = (() => {

    const w = extend(Weapon, {
        load() {
            // Add a prefix prevent confliction with other mods
            this.name = lib.aModName + '-' + 'invincible-ship-weapon';
            this.super$load();

            // const assetName = lib.aModName + '-' + this.name;
            // this.region = Core.atlas.find(
            //     assetName + "-equip",
            //     Core.atlas.find(assetName + "-equip", Core.atlas.find("clear"))
            // );
            // print('load ' + this.name + '-equip : ' + this.region);
        },
    });

    w.length = 1.5;
    w.reload = 14;
    w.alternate = true;
    w.ejectEffect = Fx.shellEjectSmall;
    w.name = lib.aModName + '-' + 'invincible-ship-weapon';
    w.bullet = invincibleBulletType;
    return w;
})();

const mech = (() => {
    const healRange = 120;
    const healAmount = 20000;
    const healReload = 60;
    var wasHealed;
    const m = extendContent(Mech, 'invincible-ship', {
        getExtraArmor(player) {
            return 10000;
        },
        updateAlt(player) {
            var shield = globalLancerMechShield.getShield(player, false);
            // shield.charge(player.isShooting() ? 1 : 0);
            shield.defence();

            if (player.timer.get(Player.timerAbility, healReload)) {
                wasHealed = false;

                Units.nearby(player.getTeam(), player.x, player.y, healRange, cons(unit => {
                    if (unit.health < unit.maxHealth()) {
                        Effects.effect(Fx.heal, unit);
                        wasHealed = true;
                    }
                    unit.healBy(healAmount);
                }));

                shield.charge(2);
                if (wasHealed) {
                    Effects.effect(Fx.healWave, player);
                }
            }
        },
        draw(player) {
            var shield = globalLancerMechShield.getShield(player, false);
            shield.draw();
        }
    });

    m.weapon = invincibleWeapon;
    m.flying = true;
    m.speed = 0.9;
    m.boostSpeed = 12122.6;
    m.drag = 0.06;
    m.cellTrnsY = 1;
    m.mass = 31210;
    m.shake = 3;
    m.health = 1;
    m.mineSpeed = 50000;
    m.drillPower = 2147483647;
    m.buildPower = Infinity;
    m.engineColor = Color.valueOf("d97ff4");
    m.itemCapacity = 999;
    m.turnCursor = true;
    m.canHeal = false;
    m.compoundSpeed = 8;
    m.compoundSpeedBoost = 3;
    m.drawCell = true;
    m.drawItems = true;
    m.drawLight = true;
    m.engineOffset = 5;
    m.engineSize = 3;
    m.weaponOffsetY = -2;
    m.weaponOffsetX = 5;

    return m;
})();
// So I move the definition to js, 'content error' again?
const mechPad = extendContent(MechPad, 'invincible-ship-pad', {
    load() {
        this.mech = mech;
        this.super$load();
    },
});
mechPad.mech = mech;
