
// 死

const lib = require('super-cheat/lib');

const invincibleBulletType = (() => {

    const bt = extend(PointBulletType, {
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

    const tailEffectTime = 12;
    const trialEffect = lib.newEffect(tailEffectTime, e => {
        let fx = Angles.trnsx(e.rotation, 24)
        let fy = Angles.trnsy(e.rotation, 24)
        Lines.stroke(3 * e.fout(), Pal.spore);
        Lines.line(e.x, e.y, e.x + fx, e.y + fy);

        Drawf.light(e.x, e.y, 60 * e.fout(), Pal.spore, 0.5);
    });
    const hitEffect = lib.newEffect(8, (e) => {
        Draw.color(Pal.spore);
        Lines.stroke(e.fout() * 1.5);

        Angles.randLenVectors(e.id, 8, e.finpow() * 22, lib.floatc2((x, y) => {
            let ang = Mathf.angle(x, y);
            Lines.lineAngle(e.x + x, e.y + y, ang, e.fout() * 4 + 1);
        }));
    });

    bt.damage = Infinity;
    // bt.splashDamage = Infinity;
    bt.speed = 0.00001;
    // bt.hitSize = 6;
    // bt.width = 9;
    // bt.height = 45;
    // bt.lifetime = 0;
    bt.inaccuracy = 0
    bt.keepVelocity = false
    bt.trailSpacing = 20
    bt.hitShake = 0.3
    bt.despawnEffect = hitEffect
    bt.hitEffect = hitEffect
    bt.trailEffect = trialEffect
    return bt;
})();

const shootEffect = lib.newEffect(21, e => {
    Draw.color(Pal.spore)
    for (let i of Mathf.signs) {
        Drawf.tri(e.x, e.y, 4 * e.fout(), 29, e.rotation + 90 * i);
    }
});

const turret = extend(Turret, 'point-turret', {
});
turret.shootEffect = shootEffect

lib.setBuildingSimple(turret, Turret.TurretBuild, {
    hasAmmo() { return true; },
    peekAmmo() { return invincibleBulletType; },
    useAmmo() { return invincibleBulletType; },
    shoot(type) {
        if (this.isControlled() || this.logicShooting) {
            this.super$shoot(type)
        } else if (this.target) {
            if (this.target instanceof Packages.mindustry.gen.Buildingc) {
                this.target.killed()
            } else if (this.target instanceof Packages.mindustry.gen.Unitc) {
                Call.unitDestroy(this.target.id)
            }
            const rot = this.rotation
            this.totalShots += 1
            let bulletX = this.x + Angles.trnsx(rot - 90, turret.shootX, turret.shootY)
            let bulletY = this.y + Angles.trnsy(rot - 90, turret.shootX, turret.shootY)
            turret.shootSound.at(bulletX, bulletY, Mathf.random(turret.soundPitchMin, turret.soundPitchMax))

            turret.ammoUseEffect.at(
                this.x - Angles.trnsx(rot, turret.ammoEjectBack),
                this.y - Angles.trnsy(rot, turret.ammoEjectBack),
                rot * Mathf.sign(0)
            )

            const angle = Mathf.angle(this.target.x - bulletX, this.target.y - bulletY)
            Geometry.iterateLine(0, bulletX, bulletY, this.target.x, this.target.y, type.trailSpacing,
                lib.floatc2((x, y) => {
                    type.trailEffect.at(x, y, angle);
                })
            )

            if (turret.shootEffect) {
                turret.shootEffect.at(bulletX, bulletY, angle, Pal.spore)
            }
            if (turret.shake > 0){
                Effect.shake(turret.shake, turret.shake, this)
            }
            this.useAmmo()
            this.curRecoil = 1
            this.heat = 1
        } else {
            this.super$shoot(type)
        }
    },
});

turret.targetInterval = 0;
