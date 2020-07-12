
// 死

const lib = require('super-cheat/lib');


const destoryBeamBulletType = (() => {
    const THE_COLOR = Color.purple;

    const fragBulletType = (() => {

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

        const bt = extend(BasicBulletType, {
            load() {
                this.super$load();
                this.healPercent = 500;
                this.speed = 3.5;
                this.damage = Infinity;
                this.homingPower = 25;
                this.homingRange = 50;
                this.splashDamage = 3;
                this.splashDamageRadius = 10;
                this.hitEffect = hitEffect;
                this.despawnEffect = despawnEffect;
                this.lifetime = 35;
                this.shootEffect = Fx.none;
            },
            collides(b, tile){
                return tile.getTeam() != b.getTeam() || tile.entity.healthf() < 1;
            },
            hitTile(b, tile) {
                this.super$hitTile(b, tile);
                if (tile && tile.ent() && tile.getTeam() != b.getTeam()) {
                    Call.onTileDestroyed(tile);
                }
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
                // if (b.timer.get(1, 1)) {
                //     Effects.effect(tailEffect, THE_COLOR, b.x, b.y, b.rot());
                // }
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
            },
            hit(b, x, y) {
                x = x ? x : b.x;
                y = y ? y : b.y;
                Units.closestEnemy(b.team, x, y, this.splashDamageRadius, boolf(unit => { unit.kill(); return false; }));
                this.super$hit(b, x, y);
            },
        });
        return bt;
    })();

    const tailEffectTime = 12;
    const tailEffect = newEffect(tailEffectTime, e => {
        Draw.color(Color.black, THE_COLOR, Math.max(0, e.fout() * 2 - 1));
        Drawf.tri(e.x, e.y, 8 * e.fout(), 16, e.rotation);
        Drawf.tri(e.x, e.y, 8 * e.fout(), 30 * Math.min(1, e.data.time / 8 * 0.8 + 0.2), e.rotation - 180);
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

    const bt = extend(BasicBulletType, {
        load() {
            this.hitSize = 8;
            this.healPercent = 1000;
            this.speed = 6;
            this.damage = Infinity;
            this.homingPower = 60;
            this.homingRange = 240;
            this.splashDamage = Infinity;
            this.splashDamageRadius = 30;
            this.shootEffect = Fx.none;
            this.hitEffect = hitEffect;
            this.despawnEffect = despawnEffect;
            this.fragBullet = fragBulletType;
            this.fragBullets = 6;
            this.lifetime = 110;
        },
        hitTile(b, tile) {
            this.super$hitTile(b, tile);
            if (tile && tile.ent() && tile.getTeam() != b.getTeam()) {
                Call.onTileDestroyed(tile);
            }
        },
        hit(b, x, y) {
            x = x ? x : b.x;
            y = y ? y : b.y;
            Units.closestEnemy(b.team, x, y, this.splashDamageRadius, boolf(unit => { unit.kill(); return false; }));
            this.super$hit(b, x, y);
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

const turret = extendContent(Turret, 'must-die-turret', {
    load() {
        this.super$load();
        this.baseRegion = Core.atlas.find(lib.aModName + "-must-die-turret-base");
        this.targetInterval = 0;
    },
    generateIcons(){
        const list = this.super$generateIcons();
        list[0] = Core.atlas.find(lib.aModName + "-must-die-turret-base");
        list[1] = Core.atlas.find(this.name);
        return list;
    },
    // shoot(tile, type) {

    //     var entity = tile.ent();

    //     entity.recoil = this.recoil;
    //     entity.heat = 1;

    //     this.tr.trns(entity.rotation, 12, Mathf.range(this.xRand));

    //     for(var i = 0; i < this.shots; i++){
    //         this.bullet(tile, type, entity.rotation + Mathf.range(this.inaccuracy + type.inaccuracy) + (i - this.shots / 2) * this.spread);
    //     }

    //     this.effects(tile);
    //     this.useAmmo(tile);
    // },
    hasAmmo(tile) { return true; },
    peekAmmo(tile) { return this.shootType; },
    useAmmo(tile) { return this.shootType; },
    handleDamage(tile, amount) { return 0; },
    handleBulletHit(entity, bullet) { },
});

turret.shootType = destoryBeamBulletType;
