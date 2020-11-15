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
function defineTurretBullet(turret, bullets, options) {
    if (!(bullets instanceof Array)) {
        bullets = [bullets];
    }
    const finalOptions = Object.assign({
        shotChance: 0.025,
        speed: 2.5,
        lifetime: 150,
        damage: turret.health / 20,
        shrinkY: 0,
        drag : -0.01,
        splashDamageRadius: 30,
        splashDamage: 20,
        ammoMultiplier: 4,
        hitEffect: Fx.blastExplosion,
        despawnEffect: Fx.blastExplosion,
        homingPower: 0.08,
        homingRange: 100,
        homingDelay: 20,
        inaccuracy: 5,
        trailChance: 0,
        status: StatusEffects.blasted,
        statusDuration: 60,
        spin: 8,
        backColor: Color.valueOf("00000000"),
        frontColor: Color.valueOf("beacbe"),
    }, options);
    const name = turret.name;
    var t = new JavaAdapter(BasicBulletType, {
        update(b) {
            this.super$update(b);
            if (Mathf.chanceDelta(finalOptions.shotChance)) {
                turret.shootSound.at(b.x, b.y, Mathf.random(0.9, 1.1));
                var angle = b.time * this.spin + b.vel.angle();
                bullets[randomInt(0, bullets.length)].create(b, b.team, b.x, b.y, angle, 0.8, 0.8);
                turret.shootEffect.at(b.x, b.y, angle);
            }
        }
    }, finalOptions.speed, finalOptions.damage, name);

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
    di(Blocks.duo, { shotChance: 0.03 });
    di(Blocks.scatter, { shotChance: 0.05 });
    di(Blocks.scorch, { shotChance: 0.06 });
    di(Blocks.hail, { shotChance: 0.03 });
    di(Blocks.wave, { shotChance: 0.1 });
    d(Blocks.lancer, Blocks.lancer.shootType, { shotChance: 0.03 });
    d(Blocks.arc, Blocks.arc.shootType, { shotChance: 0.03 });
    di(Blocks.swarmer, { shotChance: 0.03 });
    di(Blocks.salvo, { shotChance: 0.06 });
    di(Blocks.tsunami, { shotChance: 0.1 });
    di(Blocks.fuse, { shotChance: 0.04 });
    di(Blocks.ripple, { shotChance: 0.05 });
    di(Blocks.cyclone, { shotChance: 0.1 });
    di(Blocks.spectre, { shotChance: 0.1 });
    d(Blocks.meltdown, Blocks.meltdown.shootType, { shotChance: 0.05 });

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
