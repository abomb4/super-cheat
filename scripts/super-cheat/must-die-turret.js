
// 死

const lib = require('super-cheat/lib');


const destoryBeamBulletType = (() => {
    const THE_COLOR = Color.purple;

    const fragBulletType = (() => {

        const hitEffect = lib.newEffect(8, (e) => {
            Draw.color(Color.black, THE_COLOR, e.fin());
            Lines.stroke(0.5 + e.fout());
            Lines.circle(e.x, e.y, e.fin() * 10);
        });

        const despawnEffect = lib.newEffect(8, (e) => {
            Draw.color(Color.black, THE_COLOR, e.fin());
            Lines.stroke(0.5 + e.fout());
            Lines.circle(e.x, e.y, e.fin() * 5);
        });

        const bt = extend(BasicBulletType, {
            hitEntity(b, other, initialHealth) {
                if (other && other.kill) {
                    // other.kill();
                    Call.unitDestroy(other.id)
                }
            },
            hitTile(b, tile, x, y, health, direct) {
                this.super$hitTile(b, tile, x, y, health, direct);
                if (tile && tile.team != b.team) {
                    tile.killed();
                }
            },
            draw(b) {
                Draw.color(THE_COLOR);
                // Lines.stroke(1);
                // Lines.lineAngleCenter(b.x, b.y, b.rotation(), 6);
                // Draw.color(Color.white);
                // Lines.lineAngleCenter(b.x, b.y, b.rotation(), 1);

                Drawf.tri(b.x, b.y, 4, 8, b.rotation());
                Drawf.tri(b.x, b.y, 4, 12, b.rotation() - 180);
                Draw.reset();
            },
            update(b) {
                // Rewrite homing power (adds a delay) trail logic
                if (this.homingPower > 0.0001 && b.time > 12) {
                    var target = Units.closestTarget(b.team, b.x, b.y, this.homingRange,
                        boolf(e => (e.isGrounded() && this.collidesGround) || (e.isFlying() && this.collidesAir)),
                        boolf(t => this.collidesGround)
                    );
                    if (target != null) {
                        b.vel.setAngle(Mathf.slerpDelta(b.rotation(), b.angleTo(target), this.homingPower));
                    }
                }
            },
        });
        bt.pierce = true;
        bt.pierceCap = 6;
        bt.pierceBuilding = false;
        bt.healPercent = 500;
        bt.speed = 3.5;
        bt.damage = Infinity;
        bt.homingPower = 0.3;
        bt.homingRange = 50;
        bt.splashDamage = 3;
        bt.splashDamageRadius = 10;
        bt.hitEffect = hitEffect;
        bt.despawnEffect = despawnEffect;
        bt.lifetime = 35;
        bt.shootEffect = Fx.none;
        return bt;
    })();

    const tailEffectTime = 12;
    const tailEffect = lib.newEffect(tailEffectTime, e => {
        Draw.color(Color.black, THE_COLOR, Math.max(0, e.fout() * 2 - 1));
        Drawf.tri(e.x, e.y, 8 * e.fout(), 16, e.rotation);
        Drawf.tri(e.x, e.y, 8 * e.fout(), 30 * Math.min(1, e.data.time / 8 * 0.8 + 0.2), e.rotation - 180);
    });

    const hitEffect = lib.newEffect(8, (e) => {
        Draw.color(Color.black, THE_COLOR, e.fin());
        Lines.stroke(0.5 + e.fout());
        Lines.circle(e.x, e.y, e.fin() * 30);
    });

    const despawnEffect = lib.newEffect(8, (e) => {
        Draw.color(Color.black, THE_COLOR, e.fin());
        Lines.stroke(0.5 + e.fout());
        Lines.circle(e.x, e.y, e.fin() * 5);
    });

    const bt = extend(BasicBulletType, {
        hitTile(b, tile, x, y, health, direct) {
            this.super$hitTile(b, tile, x, y, health, direct);
            if (tile && tile.team != b.team) {
                tile.killed()
            }
        },
        draw(b) {
            Draw.color(THE_COLOR);
            // Lines.stroke(2);
            // Lines.lineAngleCenter(b.x, b.y, b.rotation(), 15);
            // Draw.color(Color.white);
            // Lines.lineAngleCenter(b.x, b.y, b.rotation(), 1);

            Drawf.tri(b.x, b.y, 8, 16, b.rotation());
            Drawf.tri(b.x, b.y, 8, 30 * Math.min(1, b.time / this.speed * 0.8 + 0.2), b.rotation() - 180);
            Draw.reset();
        },
        update(b) {
            // Rewrite homing power (adds a delay) trail logic
            if (this.homingPower > 0.0001 && b.time > 25) {
                var target = Units.closestTarget(b.team, b.x, b.y, this.homingRange,
                    boolf(e => (e.isGrounded() && this.collidesGround) || (e.isFlying() && this.collidesAir)),
                    boolf(t => this.collidesGround)
                );
                if (target != null) {
                    b.vel.setAngle(Mathf.slerpDelta(b.rotation(), b.angleTo(target), this.homingPower));
                }
            }

            if (b.timer.get(1, 1)) {
                tailEffect.at(b.x, b.y, b.rotation(), THE_COLOR, { time: ((v) => v)(b.time) });
            }
        },
    });
    bt.pierce = true;
    bt.pierceCap = 6;
    bt.pierceBuilding = false;
    bt.hitSize = 8;
    bt.healPercent = 1000;
    bt.speed = 6;
    bt.damage = Infinity;
    bt.homingPower = 0.3;
    bt.homingRange = 240;
    bt.splashDamage = Infinity;
    bt.splashDamageRadius = 30;
    bt.shootEffect = Fx.none;
    bt.hitEffect = hitEffect;
    bt.despawnEffect = despawnEffect;
    bt.fragBullet = fragBulletType;
    bt.fragBullets = 6;
    bt.lifetime = 110;
    return bt;
})();

const turret = extend(Turret, 'must-die-turret', {
    load() {
        this.super$load();
        this.baseRegion = lib.loadRegion("must-die-turret-base");
    },
    // generateIcons(){
    //     const list = this.super$generateIcons();
    //     list[0] = Core.atlas.find(lib.modName + "-must-die-turret-base");
    //     list[1] = Core.atlas.find(this.name);
    //     return list;
    // },
});

lib.setBuildingSimple(turret, Turret.TurretBuild, {
    hasAmmo() { return true; },
    peekAmmo() { return destoryBeamBulletType; },
    useAmmo() { return destoryBeamBulletType; },
});

turret.targetInterval = 0;
