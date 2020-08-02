/*
 * 此文件描述没法挡子弹的冷冻力场，原理复杂，开 mod 服务器时有可能会死。
 * 如此复杂的原因：(md 一堆 package-private 级别的字段，根本没法继承，只能都重写一遍了)
 * 1. update 难以定制，想去掉挡子弹的代码很不容易
 * 2. 力场颜色难以修改，因为 update() 里面写死了 new ShieldEntity，并且力场的渲染是在 Renderer 里写死的
 */

const lib = require('super-cheat/lib');

const theShieldBuffer = new Packages.arc.graphics.gl.FrameBuffer(2, 2);

// const theColor = Pal.accent
const theColor = Pal.heal;

const theEntityGroup = Vars.entities.add(BaseEntity).enableMapping();
const theShieldGroup = Vars.entities.add(BaseEntity, true).enableMapping();
var shieldUpdateLock = null;
function updateShield(b) {
    if (shieldUpdateLock == null) shieldUpdateLock = b;
    if (shieldUpdateLock == b) {
        theShieldGroup.update();
    }
}
function unlockUpdateShield(b) {
    if (shieldUpdateLock == b) shieldUpdateLock = null;
}

const forceEntity = () => {
    const s = extend(TileEntity, {
        _shield: null,
        _broken: true,
        _buildup: 0,
        _radscl: 0,
        _hit: 0,
        _warmup: 0,
        _phaseHeat: 0,
        getShield() { return this._shield; },
        getBroken() { return this._broken; },
        getBuildup() { return this._buildup; },
        getRadscl() { return this._radscl; },
        getHit() { return this._hit; },
        getWarmup() { return this._warmup; },
        getPhaseHeat() { return this._phaseHeat; },
        setShield(v) { this._shield = v; },
        setBroken(v) { this._broken = v; },
        setBuildup(v) { this._buildup = v || 0; },
        setRadscl(v) { this._radscl = v || 0; },
        setHit(v) { this._hit = v || 0; },
        setWarmup(v) { this._warmup = v || 0; },
        setPhaseHeat(v) { this._phaseHeat = v || 0; },

        write(stream) {
            this.super$write(stream);
            stream.writeBoolean(this.broken);
            stream.writeFloat(this.buildup);
            stream.writeFloat(this.radscl);
            stream.writeFloat(this.warmup);
            stream.writeFloat(this.phaseHeat);
        },

        read(stream, revision) {
            this.super$read(stream, revision);
            this.broken = stream.readBoolean();
            this.buildup = stream.readFloat();
            this.radscl = stream.readFloat();
            this.warmup = stream.readFloat();
            this.phaseHeat = stream.readFloat();
        },
    });

    return s;
};
var fakeShieldEntityLoaded = false;
const fakeShieldEntity = () => {
    if (!fakeShieldEntityLoaded) {
        const fakeTile = new Tile(0, 0);
        const x = new JavaAdapter(ForceProjector.ShieldEntity, {
            update() {
                this.x = Core.camera.position.x;
                this.y = Core.camera.position.y;
            },

            drawSize() {
                return 8;
            },
            draw() {
                // print('complex draw!');
                const camera = Core.camera;
                const settings = Core.settings;
                const shieldBuffer = theShieldBuffer;
                const graphics = Core.graphics;

                if (!graphics.isHidden()
                    && (Core.settings.getBool("animatedwater") || Core.settings.getBool("animatedshields"))
                    && (shieldBuffer.getWidth() != graphics.getWidth() || shieldBuffer.getHeight() != graphics.getHeight())) {
                    shieldBuffer.resize(graphics.getWidth(), graphics.getHeight());
                }

                if (theShieldGroup.countInBounds() > 0) {
                    // print('complex draw><><>><!');
                    if (settings.getBool("animatedshields") && Shaders.shield != null) {
                        Draw.flush();
                        shieldBuffer.begin();
                        graphics.clear(Color.clear);
                        theShieldGroup.draw();
                        theShieldGroup.draw(boolf(shield => true), cons(v => v.drawOver()));
                        Draw.flush();
                        shieldBuffer.end();
                        // Draw.shader(Shaders.water);
                        Draw.color(theColor);
                        Draw.rect(Draw.wrap(shieldBuffer.getTexture()), camera.position.x, camera.position.y, camera.width, -camera.height);
                        Draw.color();
                        // Draw.shader();
                    } else {
                        theShieldGroup.draw(boolf(shield => true), cons(v => v.drawSimple()));
                    }
                }
            },
            drawOver() {
                // print('do!');
            },

            drawSimple() {
                theShieldGroup.draw(boolf(shield => true), cons(v => v.drawSimple()));
                // print('ds!');
            },
        }, null, fakeTile)
        x.add();
        fakeShieldEntityLoaded = true;
    }
};
Events.on(EventType.WorldLoadEvent, run(() => {
    fakeShieldEntityLoaded = false;
    shieldUpdateLock = null;
}));

const shieldEntity = (force, tile) => {
    const e = extend(EffectEntity, {
        entity: tile.ent(),

        update() {
            if (this.entity.isDead() || !this.entity.isAdded()) {
                this.remove();
            }
        },

        drawSize() {
            return force.realRadius(this.entity) * 2 + 2;
        },

        draw() {
            Draw.color(theColor);
            Fill.poly(this.x, this.y, 6, force.realRadius(this.entity));
            Draw.color();
        },

        drawOver() {
            if (this.entity.getHit() <= 0) return;

            Draw.color(Color.white);
            Draw.alpha(this.entity.getHit());
            Fill.poly(this.x, this.y, 6, force.realRadius(this.entity));
            Draw.color();
        },

        drawSimple() {
            if (force.realRadius(this.entity) < 0.5) return;

            const rad = force.realRadius(this.entity);

            Draw.color(theColor);
            Lines.stroke(1.5);
            Draw.alpha(0.09 + 0.08 * this.entity.getHit());
            Fill.poly(this.x, this.y, 6, rad);
            Draw.alpha(1);
            Lines.poly(this.x, this.y, 6, rad);
            Draw.reset();
        },

        targetGroup() {
            return theShieldGroup;
        },
    });

    e.set(tile.drawx(), tile.drawy());
    fakeShieldEntity();

    return e;
};

const noDamageEffect = new StatusEffect("noDamageEffect");

noDamageEffect.effect = Fx.none;
noDamageEffect.damageMultiplier = 0;

const blockType = extendContent(Block, "enemys-no-damage", {
    _timerUse: 0,
    getTimerUse() { return this._timerUse; },
    setTimerUse(v) { this._timerUse = v; },
    phaseUseTime: 200,
    phaseRadiusBoost: 100,
    radius: 0,
    breakage: 0,
    cooldownNormal: 3,
    cooldownLiquid: 1.5,
    cooldownBrokenBase: 5,
    basePowerDraw: 5,
    topRegion: null,

    hasEntity() {
        return true;
    },
    outputsItems() {
        return false;
    },
    init() {
        this.super$init();
        const timer = this.timers++;
        this.setTimerUse(timer);
        this.destructible = true;
        this.entityType = new Prov({
            get: function () {
                return forceEntity();
            }
        });
        this.phaseUseTime = 300;
        this.phaseRadiusBoost = 100;
        this.radius = 200;
        this.breakage = 100;
        this.cooldownNormal = 3;
        this.cooldownLiquid = 5;
        this.cooldownBrokenBase = 5;
        this.basePowerDraw = 10;
    },
    load() {
        this.super$load();
        this.topRegion = Core.atlas.find(this.name + "-top");
    },
    setStats() {
        this.super$setStats();

        this.stats.add(BlockStat.powerUse, this.basePowerDraw * 60, StatUnit.powerSecond);
        this.stats.add(BlockStat.boostEffect, this.phaseRadiusBoost / Vars.tilesize, StatUnit.blocks);
    },
    drawPlace(x, y, rotation, valid) {
        this.super$drawPlace(x, y, rotation, valid);

        Draw.color(Pal.accent);
        Lines.stroke(1);
        Lines.poly(x * Vars.tilesize, y * Vars.tilesize, 6, this.radius);
        Draw.color();
    },
    removed(tile) {
        const entity = tile.ent();
        unlockUpdateShield(entity);
        if (entity.getShield() != null) {
            entity.getShield().remove();
        }
    },
    update(tile) {
        /* ForceEntity */
        updateShield(tile.ent());
        const entity = tile.ent();
        const tilesize = this.tilesize;
        const breakage = this.breakage;
        const cooldownNormal = this.cooldownNormal;
        const cooldownBrokenBase = this.cooldownBrokenBase;
        const consumes = this.consumes;
        const cooldownLiquid = this.cooldownLiquid;
        const radius = this.radius;
        const timerUse = this.getTimerUse();
        const phaseUseTime = this.phaseUseTime;
        const phaseRadiusBoost = this.phaseRadiusBoost;

        if (entity.getShield() == null) {
            const shield = shieldEntity(this, tile)
            entity.setShield(shield);
            shield.add();
        }

        const phaseValid = consumes.get(ConsumeType.item).valid(tile.entity);
        // print('284 phaseValid: ' + phaseValid + ', timerUse: ' + timerUse + ", phaseUseTime: " + phaseUseTime);
        // print('285 entity.getBroken(): ' + entity.getBroken() + ', entity.efficiency(): ' + entity.efficiency());
        entity.setPhaseHeat(Mathf.lerpDelta(entity.getPhaseHeat(), Mathf.num(phaseValid), 0.1));

        if (phaseValid && !entity.getBroken() && entity.timer.get(timerUse, phaseUseTime) && entity.efficiency() > 0) {
            entity.cons.trigger();
        }
        // print('291 phaseValid: ' + phaseValid);

        entity.setRadscl(Mathf.lerpDelta(entity.getRadscl(), entity.getBroken() ? 0 : entity.getWarmup(), 0.05));

        if (Mathf.chance(Time.delta() * entity.getBuildup() / breakage * 0.1)) {
            Effects.effect(Fx.reactorsmoke, tile.drawx() + Mathf.range(tilesize / 2), tile.drawy() + Mathf.range(tilesize / 2));
        }

        entity.setWarmup(Mathf.lerpDelta(entity.getWarmup(), entity.efficiency(), 0.1));

        if (entity.getBuildup() > 0) {
            const scale = !entity.getBroken() ? cooldownNormal : cooldownBrokenBase;
            const cons = consumes.get(ConsumeType.liquid);
            if (cons.valid(entity)) {
                cons.update(entity);
                scale *= (cooldownLiquid * (1 + (entity.liquids.current().heatCapacity - 0.4) * 0.9));
            }

            entity.setBuildup(entity.getBuildup() - Time.delta() * scale);
        }

        if (entity.getBroken() && entity.getBuildup() <= 0) {
            entity.setBroken(false);
        }

        if (entity.getBuildup() >= breakage && !entity.getBroken()) {
            entity.setBroken(true);
            entity.setBuildup(breakage);
            Effects.effect(Fx.shieldBreak, tile.drawx(), tile.drawy(), radius);
        }

        if (entity.getHit() > 0) {
            entity.setHit(entity.getHit() - 1 / 5 * Time.delta());
        }

        const realRadius = (radius + entity.getPhaseHeat() * phaseRadiusBoost) * entity.getRadscl()

        // paramTile = tile;
        // paramEntity = entity;
        // paramBlock = this;
        // bulletGroup.intersect(tile.drawx() - realRadius, tile.drawy() - realRadius, realRadius * 2, realRadius * 2, shieldConsumer);

        if (!entity.getBroken()) {
            Vars.unitGroup.intersect(tile.drawx() - realRadius, tile.drawy() - realRadius, realRadius * 2, realRadius * 2, new Cons({
                get(v) {
                    if (v.getTeam() != tile.getTeam() && Intersector.isInsideHexagon(v.getX(), v.getY(), realRadius * 2, tile.drawx(), tile.drawy())) {
                        v.applyEffect(noDamageEffect, 30);
                    }
                },
            }));
        }
    },
    realRadius(entity) {
        return (this.radius + entity.getPhaseHeat() * this.phaseRadiusBoost) * entity.getRadscl();
    },
    draw(tile) {
        this.super$draw(tile);
        const entity = tile.ent();
        // if (entity.getShield() != null) {
        //     entity.getShield().draw();
        // }
        if (entity.getBuildup() <= 0) return;
        Draw.alpha(entity.getBuildup() / this.breakage * 0.75);
        Draw.blend(Blending.additive);
        Draw.rect(this.topRegion, tile.drawx(), tile.drawy());
        Draw.blend();
        Draw.reset();
    },
    targetGroup() {
        return theEntityGroup;
    },
    // handleDamage(tile) { return 0; },
});
blockType.update = true;
blockType.consumes.item(Items.copper).boost();
