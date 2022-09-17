
const lib = require('super-cheat/lib');

const THE_COLOR = Color.valueOf("ff1111");

const healBeamFrag = (() => {

    const tailEffect = newEffect(6, e => {
        Draw.color(Color.black, THE_COLOR, Math.max(0, e.fout() * 2 - 1));
        Drawf.tri(e.x, e.y, 4 * e.fout(), 8, e.rotation);
        Drawf.tri(e.x + Angles.trnsx(e.rotation, 8), e.y + Angles.trnsy(e.rotation, 8), 4 * (e.fout() * 0.8 + 0.2), 24 * (e.fin() * 0.8 + 0.2), e.rotation - 180);
    });

    const hitEffect = newEffect(8, (e) => {
        Draw.color(Color.black, THE_COLOR, e.fin());
        Lines.stroke(0.5 + e.fout());
        Lines.circle(e.x, e.y, e.fin() * 10);
    });

    const despawnEffect = newEffect(8, (e) => {
        Draw.color(Color.black, THE_COLOR, e.fin());
        Lines.stroke(0.5 + e.fout());
        Lines.circle(e.x, e.y, e.fin() * 5);
    });

    const bt = extend(HealBulletType, {
        load() {
            this.super$load();
            this.healPercent = 5;
            this.speed = 3;
            this.damage = 6;
            this.homingPower = 15;
            this.homingRange = 50;
            this.splashDamage = 3;
            this.splashDamageRadius = 10;
            this.hitEffect = hitEffect;
            this.despawnEffect = despawnEffect;
            this.lifetime = 20;
            this.shootEffect = Fx.none;
        },
        collides(b, tile){
            return tile.getTeam() != b.getTeam() || tile.entity.healthf() < 1;
        },
        draw(b) {
            Draw.color(THE_COLOR);
            // Lines.stroke(1);
            // Lines.lineAngleCenter(b.x, b.y, b.rot(), 6);
            // Draw.color(Color.white);
            // Lines.lineAngleCenter(b.x, b.y, b.rot(), 1);

            Drawf.tri(b.x, b.y, 4, 8, b.rot());
            Drawf.tri(b.x, b.y, 4, 12, b.rot() - 180);
            Draw.reset();
        },
        update(b) {
            if (b.timer.get(1, 1)) {
                Effects.effect(tailEffect, THE_COLOR, b.x, b.y, b.rot());
            }
            if (this.homingPower > 0.0001) {
                var target = Units.closestTarget(b.getTeam(), b.x, b.y, this.homingRange, boolf(e => !e.isFlying() || this.collidesAir));
                if (target != null) {
                    b.velocity().setAngle(Mathf.slerpDelta(b.velocity().angle(), b.angleTo(target), 0.2));
                }
            }
        },
        hitTile(b, tile) {
            this.hit(b);
            tile = tile.link();

            if (tile.entity != null && tile.getTeam() == b.getTeam() && (tile.block() != BuildBlock)) {
                Effects.effect(Fx.healBlockFull, THE_COLOR, tile.drawx(), tile.drawy(), tile.block().size);
                tile.entity.healBy(this.healPercent / 100 * tile.entity.maxHealth());
            }
        }
    });
    return bt;
})();
const healBeam = (() => {
    const tailEffectTime = 12;
    const tailEffect = newEffect(tailEffectTime, e => {
        Draw.color(Color.black, THE_COLOR, Math.max(0, e.fout() * 2 - 1));
        Drawf.tri(e.x, e.y, 8 * e.fout(), 16, e.rotation);
        Drawf.tri(e.x, e.y, 8 * e.fout(), 30 * Math.min(1, e.data.time / 6 * 0.8 + 0.2), e.rotation - 180);
    });

    const hitEffect = newEffect(8, (e) => {
        Draw.color(Color.black, THE_COLOR, e.fin());
        Lines.stroke(0.5 + e.fout());
        Lines.circle(e.x, e.y, e.fin() * 30);
    });

    const despawnEffect = newEffect(8, (e) => {
        Draw.color(Color.black, THE_COLOR, e.fin());
        Lines.stroke(0.5 + e.fout());
        Lines.circle(e.x, e.y, e.fin() * 5);
    });

    const bt = extend(HealBulletType, {
        load() {
            this.hitSize = 8;
            this.healPercent = 10;
            this.speed = 6;
            this.damage = 30;
            this.homingPower = 60;
            this.homingRange = 240;
            this.splashDamage = 10;
            this.splashDamageRadius = 30;
            this.hitEffect = hitEffect;
            this.despawnEffect = despawnEffect;
            this.fragBullet = healBeamFrag;
            this.fragBullets = 6;
            this.lifetime = 60;
        },
        draw(b) {
            Draw.color(THE_COLOR);
            // Lines.stroke(2);
            // Lines.lineAngleCenter(b.x, b.y, b.rot(), 15);
            // Draw.color(Color.white);
            // Lines.lineAngleCenter(b.x, b.y, b.rot(), 1);

            Drawf.tri(b.x, b.y, 8, 16, b.rot());
            Drawf.tri(b.x, b.y, 8, 30 * Math.min(1, b.time() / this.speed * 0.8 + 0.2), b.rot() - 180);
            Draw.reset();
        },
        update(b) {

            if (b.timer.get(1, 1)) {
                Effects.effect(tailEffect, THE_COLOR, b.x, b.y, b.rot(), { time: ((v) => v)(b.time()) });
            }
            if (this.homingPower > 0.0001 && b.time() > 25) {
                var target = Units.closestTarget(b.getTeam(), b.x, b.y, this.homingRange, boolf(e => !e.isFlying() || this.collidesAir));
                if (target != null) {
                    b.velocity().setAngle(Mathf.slerpDelta(b.velocity().angle(), b.angleTo(target), 0.2));
                }
            }
        },
    });
    return bt;
})();

const terminatorMainWeapon = (() => {

    const fullName = lib.modName + '-' + 'super-heal-beam-weapon';
    const w = extend(Weapon, {
        load() {
            // Add a prefix prevent confliction with other mods
            this.name = fullName;
            this.super$load();

            // const assetName = lib.modName + '-' + this.name;
            // this.region = Core.atlas.find(
            //     assetName + "-equip",
            //     Core.atlas.find(assetName + "-equip", Core.atlas.find("clear"))
            // );
            // print('load ' + this.name + '-equip : ' + this.region);
        },
    });

    w.name = fullName;
    w.bullet = healBeam;
    w.inaccuracy = 0;
    w.shots = 4;
    w.spacing = 2;
    w.reload = 30;
    w.shotDelay = 3;

    w.length = 16;
    w.width = 22;
    w.shake = 0.5;
    w.recoil = 2;
    w.alternate = true;
    w.shootSound = Sounds.shootBig;
    w.ejectEffect = Fx.shellEjectMedium;
    w.shootEffect = Fx.shootBig;
    return w;
})();

const lancerLaser2 = (() => {
    const tmpColor = new Color();
    const colors = [Pal.lancerLaser.cpy().mul(1, 1, 1, 0.4), Pal.lancerLaser, Color.white];
    const tscales = [1, 0.7, 0.5, 0.2];
    const strokes = [2, 1.5, 1, 0.3];
    const lenscales = [1, 1.1, 1.13, 1.17];
    const length = 160;

    const bt = extend(BasicBulletType, {
        init(b) {
            if (b) {
                Damage.collideLine(b, b.getTeam(), this.hitEffect, b.x, b.y, b.rot(), length);
            }
        },
        range() {
            return length;
        },
        draw(b) {
            const f = Mathf.curve(b.fin(), 0, 0.2);
            const baseLen = length * f;

            Lines.lineAngle(b.x, b.y, b.rot(), baseLen);
            for (var s = 0; s < 3; s++) {
                Draw.color(colors[s]);
                for (var i = 0; i < tscales.length; i++) {
                    Lines.stroke(7 * b.fout() * (s == 0 ? 1.5 : s == 1 ? 1 : 0.3) * tscales[i]);
                    Lines.lineAngle(b.x, b.y, b.rot(), baseLen * lenscales[i]);
                }
            }
            Draw.reset();
        },
    });

    bt.hitEffect = Fx.hitLancer;
    bt.despawnEffect = Fx.none;
    bt.speed = 0.01;
    bt.hitSize = 4;
    bt.drawSize = 420;
    bt.damage = 70;
    bt.lifetime = 16;
    bt.pierce = true;
    bt.keepVelocity = false;
    bt.collidesTiles = false;

    return bt;
})();

const lancerLaserWeapon = (() => {

    const w = extend(Weapon, {
        load() {
            // Add a prefix prevent confliction with other mods
            this.name = lib.modName + '-' + 'super-cheat-lancer-weapon';
            this.super$load();

            // const assetName = lib.modName + '-' + this.name;
            // this.region = Core.atlas.find(
            //     assetName + "-equip",
            //     Core.atlas.find(assetName + "-equip", Core.atlas.find("clear"))
            // );
            // print('load ' + this.name + '-equip : ' + this.region);
        },
    });

    w.name = lib.modName + '-' + 'super-cheat-lancer-weapon';
    w.bullet = lancerLaser2;
    w.inaccuracy = 0;
    w.shots = 1;

    w.reload = 10;
    w.shake = 0.5;
    w.recoil = 2;
    w.length = 6; // Y length
    w.alternate = true;
    w.shootSound = Sounds.bigshot;
    return w;
})();

// 构建多武器集合，目前集合武器不能给 player 用
function makeGroupWeapon(mainWeapon, weapons) {

    // Create virtual shooter for every sub weapons
    const w = extend(Weapon, {
        load() {
            mainWeapon.load();
            this.name = mainWeapon.name;
            this.super$load();
            weapons.forEach(v => v.load());
        },
        update(shooter, x, y, angle, left) {
            if (angle == null && left == null) {
                // update(ShooterTrait shooter, float pointerX, float pointerY)
                mainWeapon.update(shooter, x, y);
                weapons.forEach(v => v.update(shooter, x, y));
            } else {
                // update(ShooterTrait shooter, float mountX, float mountY, float angle, boolean left)
                mainWeapon.update(shooter, x, y, angle, left);
                weapons.forEach(v => v.update(shooter, x, y, angle, left));
            }
        },
        getRecoil(player, left) {
            return mainWeapon.getRecoil(player, left);
        },
        shoot(p, x, y, angle, left) {
            // They shoot by themselvs
            // mainWeapon.shoot(p, x, y, angle, left);
        },
    });

    w.name = mainWeapon.name;
    w.bullet = mainWeapon.bullet;
    w.inaccuracy = mainWeapon.inaccuracy;
    w.shots = mainWeapon.shots;
    w.reload = mainWeapon.reload;
    w.shake = mainWeapon.shake;
    w.recoil = mainWeapon.recoil;
    w.length = mainWeapon.length;
    w.alternate = mainWeapon.alternate;
    w.shootSound = mainWeapon.shootSound;
    w.spacing = mainWeapon.spacing;
    w.shotDelay = mainWeapon.shotDelay;
    w.length = mainWeapon.length;
    w.width = mainWeapon.width;

    return w;
}

const superWeapon = makeGroupWeapon(terminatorMainWeapon, []);

const terminator = (() => {

    // const unit = extend(UnitType, 'terminator-unit', {
    //     load() {
    //         this.weapon = superHealBeamShotgunWeapon;
    //         this.super$load();
    //     },
    // });
    const unit = extend(UnitType, 'terminator-unit', {
        load() {
            this.create(prov(() => new GroundUnit()));
            // this.weapon = terminatorMainWeapon;
            this.weapon = superWeapon;
            this.super$load();
        },
    });
    return unit;
})();
