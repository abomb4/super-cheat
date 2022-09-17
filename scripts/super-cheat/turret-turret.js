const lib = require('super-cheat/lib');

function randomInt(start, end) {
    return start + Math.floor(Math.random() * end - start);
}
function bulletTypesOfItemTurret(turret) {
    const arr = [];
    const values = turret.ammoTypes.values().toSeq().iterator();
    while (values.hasNext()) {
        arr.push(values.next());
    }
    return () => arr[randomInt(0, arr.length)];
}
const hitEffects = {
    1: Fx.hitBulletBig,
    2: Fx.flakExplosion,
    3: Fx.blastExplosion,
    4: Fx.massiveExplosion
};
function defineTurretBullet(turret, takeBullet, options) {
    const tr = new Vec2();
    const finalOptions = Object.assign({
        shotChance: 0.025,
        speed: 2.8,
        lifetime: 240,
        damage: 20,
        shrinkY: 0,
        drag: -0.01,
        splashDamageRadius: 16 * turret.size,
        splashDamage: turret.health / 15,
        ammoMultiplier: 4,
        homingPower: 0.08,
        homingRange: 100,
        homingDelay: 20,
        inaccuracy: 5,
        trailChance: 0,
        status: StatusEffects.blasted,
        statusDuration: 60,
        spin: 4,
        hitEffect: hitEffects[turret.size],
        despawnEffect: hitEffects[turret.size],
        backColor: Color.valueOf("00000000"),
        frontColor: Color.valueOf("beacbe"),
    }, options);
    const name = turret.name;

    var t = (() => {
        return new JavaAdapter(BasicBulletType, {
            init(b) {
                if (b) {
                    this.super$init(b);
                    b.data = {
                        shotCounter: 0,
                        bulletLife: 0,
                        bullet: null,
                        spinDirection: [1, -1][Math.floor(Math.random() * 2)],
                        startRotation: Math.floor(Math.random() * 360)
                    };
                }
            },
            draw(b) {
                var shrinkY = this.shrinkY;
                var shrinkX = this.shrinkX;
                var height = this.height * ((1 - shrinkY) + shrinkY * b.fout());
                var width = this.width * ((1 - shrinkX) + shrinkX * b.fout());
                var offset = -90 + (this.spin != 0 ? b.time * this.spin * b.data.spinDirection + b.data.startRotation : 0);
                Draw.color(this.frontColor);
                Draw.rect(this.frontRegion, b.x, b.y, width, height, b.rotation() + offset);
                Draw.reset();
            },
            update(b) {
                this.super$update(b);

                var offset = (this.spin != 0 ? b.time * this.spin * b.data.spinDirection + b.data.startRotation : 0);
                var angle = b.rotation() + offset;
                tr.trns(angle, turret.size * Vars.tilesize / 2);
                var x = b.x + tr.x;
                var y = b.y + tr.y;

                if (b.data.bulletLife > 0) {
                    if (b.data.bullet) {
                        b.data.bulletLife = Math.max(0, b.data.bulletLife - 1);
                        b.data.bullet.rotation(angle);
                        b.data.bullet.set(x, y);
                        b.data.bullet.time = 0;
                        if (b.data.bulletLife <= 0) {
                            b.data.bullet = null;
                        }
                    } else {
                        b.data.bulletLife = 0;
                    }
                }

                if (Mathf.chanceDelta(finalOptions.shotChance)) {
                    turret.shootSound.at(b.x, b.y, Mathf.random(0.9, 1.1));
                    var bt = takeBullet();

                    if (turret.shootDuration > 0) {
                        // for meltdown
                        if (b.data.bulletLife <= 0) {
                            b.data.bulletLife = turret.shootDuration / 2;
                            b.data.bullet = bt.create(b, b.team, x, y, angle, 1, 0.8);
                            turret.shootEffect.at(x, y, angle);
                        }
                    } else if (turret.burstSpacing > 0.0001) {
                        for (var i = 0; i < turret.shots; i++) {
                            Time.run(turret.burstSpacing * i, run(() => {
                                bt.create(b, b.team, x, y, angle + Mathf.range(turret.inaccuracy + bt.inaccuracy), 0.8, 0.8);
                                turret.shootEffect.at(x, y, angle);
                                if (bt.shootEffect) {
                                    bt.shootEffect.at(x, y, angle);
                                }
                            }));
                        }
                    } else {
                        turret.shootEffect.at(x, y, angle);
                        if (bt.shootEffect) {
                            bt.shootEffect.at(x, y, angle);
                        }
                        if (turret.alternate) {
                            var i = (b.data.shotCounter % turret.shots) - (turret.shots - 1) / 2;
                            bt.create(b, b.team, x, y, angle, 0.8, 0.8);
                        } else {
                            for (var i = 0; i < turret.shots; i++) {
                                bt.create(b, b.team, x, y, angle + (i - (turret.shots / 2)) * turret.spread, 0.8 + Mathf.range(turret.velocityInaccuracy), 0.8);
                            }
                        }
                        b.data.shotCounter++;
                    }

                }
            }
        }, finalOptions.speed, finalOptions.damage, name);
    })();

    t.width = turret.size * 8;
    t.height = turret.size * 8;
    t.speed = finalOptions.speed;
    t.lifetime = finalOptions.lifetime;
    t.damage = finalOptions.damage;
    t.shrinkY = finalOptions.shrinkY;
    t.drag = finalOptions.drag;
    t.splashDamageRadius = finalOptions.splashDamageRadius;
    t.splashDamage = finalOptions.splashDamage;
    t.ammoMultiplier = finalOptions.ammoMultiplier;
    t.hitEffect = finalOptions.hitEffect;
    t.despawnEffect = finalOptions.despawnEffect;
    t.homingPower = finalOptions.homingPower;
    t.homingRange = finalOptions.homingRange;
    t.homingDelay = finalOptions.homingDelay;
    t.inaccuracy = finalOptions.inaccuracy;
    t.trailChance = finalOptions.trailChance;
    t.status = finalOptions.status;
    t.statusDuration = finalOptions.statusDuration;
    t.shrinkY = finalOptions.shrinkY;
    t.spin = finalOptions.spin;
    t.backColor = finalOptions.backColor;
    t.frontColor = finalOptions.frontColor;
    return t;
}

function defineBlockBullet(type, options, rewrites) {
    if (!rewrites) {
        rewrites = {};
    }
    const finalOptions = Object.assign({
        shotChance: 0.025,
        speed: 2.8,
        lifetime: 240,
        damage: 20,
        shrinkY: 0,
        drag: -0.01,
        splashDamageRadius: 16 * type.size,
        splashDamage: type.health / 2,
        ammoMultiplier: 4,
        homingPower: 0.08,
        homingRange: 100,
        homingDelay: 20,
        inaccuracy: 5,
        trailChance: 0,
        status: StatusEffects.blasted,
        statusDuration: 60,
        spin: 4,
        hitEffect: hitEffects[type.size],
        despawnEffect: hitEffects[type.size],
        hitSound: Sounds.none,
        backColor: Color.valueOf("00000000"),
        frontColor: Color.valueOf("beacbe"),
    }, options);

    var t = new JavaAdapter(BasicBulletType, rewrites, finalOptions.speed, finalOptions.damage, type.name);

    t.width = type.size * 8;
    t.height = type.size * 8;
    t.speed = finalOptions.speed;
    t.lifetime = finalOptions.lifetime;
    t.damage = finalOptions.damage;
    t.shrinkY = finalOptions.shrinkY;
    t.drag = finalOptions.drag;
    t.splashDamageRadius = finalOptions.splashDamageRadius;
    t.splashDamage = finalOptions.splashDamage;
    t.ammoMultiplier = finalOptions.ammoMultiplier;
    t.hitEffect = finalOptions.hitEffect;
    t.despawnEffect = finalOptions.despawnEffect;
    t.homingPower = finalOptions.homingPower;
    t.homingRange = finalOptions.homingRange;
    t.homingDelay = finalOptions.homingDelay;
    t.inaccuracy = finalOptions.inaccuracy;
    t.trailChance = finalOptions.trailChance;
    t.status = finalOptions.status;
    t.statusDuration = finalOptions.statusDuration;
    t.shrinkY = finalOptions.shrinkY;
    t.spin = finalOptions.spin;
    t.hitSound = finalOptions.hitSound;
    t.backColor = finalOptions.backColor;
    t.frontColor = finalOptions.frontColor;
    return t;
}

const tt = extend(Turret, 'turret-turret', {
    load() {
        this.super$load();
        this.region = lib.loadRegion("turret-turret")
    },
    icons() {
        return [lib.loadRegion("base-turret-turret"), lib.loadRegion("turret-turret")]
    }
});
tt.size = 4;

const bulletTypes = (() => {
    const all = lib.createProbabilitySelector();
    function d(turret, bullet, options, probability) {
        all.add(defineTurretBullet(turret, () => bullet, options), probability);
    }
    function di(turret, options, probability) {
        all.add(defineTurretBullet(turret, bulletTypesOfItemTurret(turret), options), probability);
    }
    di(Blocks.duo, { shotChance: 0.035 }, 1000);
    di(Blocks.scatter, { shotChance: 0.035 }, 1000);
    di(Blocks.scorch, { shotChance: 0.06 }, 800);
    di(Blocks.hail, { shotChance: 0.035 }, 1000);
    di(Blocks.wave, { shotChance: 0.1 }, 700);
    d(Blocks.lancer, Blocks.lancer.shootType, { shotChance: 0.03 }, 800);
    d(Blocks.arc, Blocks.arc.shootType, { shotChance: 0.04 }, 1000);
    di(Blocks.swarmer, { shotChance: 0.035 }, 800);
    di(Blocks.salvo, { shotChance: 0.035 }, 800);
    di(Blocks.tsunami, { shotChance: 0.1 }, 500);
    di(Blocks.fuse, { shotChance: 0.035 }, 700);
    di(Blocks.ripple, { shotChance: 0.02 }, 700);
    di(Blocks.cyclone, { shotChance: 0.12 }, 700);
    di(Blocks.spectre, { shotChance: 0.15 }, 600);
    d(Blocks.meltdown, Blocks.meltdown.shootType, { shotChance: 0.03 }, 400);
    // tu
    (() => {
        const tr = new Vec2();
        all.add(defineBlockBullet(Blocks.thoriumReactor, {}, {
            hit(b, x, y) {
                if (!x) { x = b.x; }
                if (!y) { y = b.y; }
                this.super$hit(b, x, y);
                Sounds.explosionbig.at(b);
                Effect.shake(6, 16, x, y);
                Fx.nuclearShockwave.at(x, y);
                for (var i = 0; i < 6; i++) {
                    Time.run(Mathf.random(40), run(() => Fx.nuclearcloud.at(x, y)));
                }
                Damage.damage(x, y,
                    Blocks.thoriumReactor.explosionRadius * Vars.tilesize,
                    Blocks.thoriumReactor.explosionDamage * 4);

                for (var i = 0; i < 20; i++) {
                    Time.run(Mathf.random(50), run(() => {
                        tr.rnd(Mathf.random(40));
                        Fx.explosion.at(tr.x + x, tr.y + y);
                    }));
                }
                for(var i = 0; i < 70; i++){
                    Time.run(Mathf.random(80), run(() => {
                        tr.rnd(Mathf.random(120));
                        Fx.nuclearsmoke.at(tr.x + x, tr.y + y);
                    }));
                }
            }
        }), 40);
    })();
    // Impact
    (() => {
        const tr = new Vec2();
        all.add(defineBlockBullet(Blocks.impactReactor, {
            backColor: Color.valueOf("4e3c4e")
        }, {
            hit(b, x, y) {
                if (!x) { x = b.x; }
                if (!y) { y = b.y; }
                this.super$hit(b, x, y);
                Sounds.explosionbig.at(b);
                Effect.shake(6, 16, x, y);
                Fx.impactShockwave.at(x, y);
                for (var i = 0; i < 6; i++) {
                    Time.run(Mathf.random(80), run(() => Fx.impactcloud.at(x, y)));
                }
                Damage.damage(x, y,
                    Blocks.impactReactor.explosionRadius * Vars.tilesize,
                    Blocks.impactReactor.explosionDamage * 4);

                for (var i = 0; i < 20; i++) {
                    Time.run(Mathf.random(80), run(() => {
                        tr.rnd(Mathf.random(40));
                        Fx.explosion.at(tr.x + x, tr.y + y);
                    }));
                }
                for(var i = 0; i < 70; i++){
                    Time.run(Mathf.random(90), run(() => {
                        tr.rnd(Mathf.random(120));
                        Fx.impactsmoke.at(tr.x + x, tr.y + y);
                    }));
                }
            }
        }), 25);
    })();
    // Self
    all.add(defineTurretBullet(tt, () => bulletTypes.random(), { shotChance: 0.08 }), 50);

    return {
        random() { return all.random(); }
    };
})();

lib.setBuildingSimple(tt, Turret.TurretBuild, {
    hasAmmo() { return true; },
    peekAmmo() { return bulletTypes.random(); },
    useAmmo() { return bulletTypes.random(); },
});
