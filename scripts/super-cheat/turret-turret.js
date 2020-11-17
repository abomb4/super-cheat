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
    return arr;
}
const hitEffects = {
    1: Fx.hitBulletBig,
    2: Fx.flakExplosion,
    3: Fx.blastExplosion,
    4: Fx.massiveExplosion
};
function defineTurretBullet(turret, bullets, options) {
    const tr = new Vec2();
    if (!(bullets instanceof Array)) {
        bullets = [bullets];
    }
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
                        spinDirection: [1, -1][Math.floor(Math.random() * 2)]
                    };
                }
            },
            draw(b) {
                var shrinkY = this.shrinkY;
                var shrinkX = this.shrinkX;
                var height = this.height * ((1 - shrinkY) + shrinkY * b.fout());
                var width = this.width * ((1 - shrinkX) + shrinkX * b.fout());
                var offset = -90 + (this.spin != 0 ? b.time * this.spin * b.data.spinDirection : 0);
                Draw.color(this.frontColor);
                Draw.rect(this.frontRegion, b.x, b.y, width, height, b.rotation() + offset);
                Draw.reset();
            },
            update(b) {
                this.super$update(b);

                var offset = (this.spin != 0 ? b.time * this.spin * b.data.spinDirection : 0);
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
                    var bt = bullets[randomInt(0, bullets.length)];

                    if (turret.shootDuration > 0) {
                        // for meltdown
                        if (b.data.bulletLife <= 0) {
                            b.data.bulletLife = turret.shootDuration;
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

const bulletTypes = (() => {
    const all = [];
    function d(turret, bullet, options) {
        all.push(defineTurretBullet(turret, bullet, options));
    }
    function di(turret, options) {
        all.push(defineTurretBullet(turret, bulletTypesOfItemTurret(turret), options));
    }
    di(Blocks.duo, { shotChance: 0.035 });
    di(Blocks.scatter, { shotChance: 0.035 });
    di(Blocks.scorch, { shotChance: 0.06 });
    di(Blocks.hail, { shotChance: 0.035 });
    di(Blocks.wave, { shotChance: 0.1 });
    d(Blocks.lancer, Blocks.lancer.shootType, { shotChance: 0.03 });
    d(Blocks.arc, Blocks.arc.shootType, { shotChance: 0.04 });
    di(Blocks.swarmer, { shotChance: 0.035 });
    di(Blocks.salvo, { shotChance: 0.035 });
    di(Blocks.tsunami, { shotChance: 0.1 });
    di(Blocks.fuse, { shotChance: 0.035 });
    di(Blocks.ripple, { shotChance: 0.02 });
    di(Blocks.cyclone, { shotChance: 0.12 });
    di(Blocks.spectre, { shotChance: 0.15 });
    d(Blocks.meltdown, Blocks.meltdown.shootType, { shotChance: 0.03 });

    return {
        random() { return all[randomInt(0, all.length)]; }
    };
})();

const turret = extendContent(Turret, 'turret-turret', {});

lib.setBuildingSimple(turret, Turret.TurretBuild, {
    hasAmmo() { return true; },
    peekAmmo() { return bulletTypes.random(); },
    useAmmo() { return bulletTypes.random(); },
});
