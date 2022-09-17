/*
 * 此文件描述没法挡子弹的冷冻力场，原理复杂，开 mod 服务器时有可能会死。
 * 如此复杂的原因：(md 一堆 package-private 级别的字段，根本没法继承，只能都重写一遍了)
 * 1. update 难以定制，想去掉挡子弹的代码很不容易
 * 2. 力场颜色难以修改，因为 update() 里面写死了 new ShieldEntity，并且力场的渲染是在 Renderer 里写死的
 */

const lib = require('super-cheat/lib');

const shieldConsumer = (paramEntity) => cons(trait => {
    if (trait.team != paramEntity.team
        && trait.type.absorbable
        && Intersector.isInsideHexagon(paramEntity.x, paramEntity.y, paramEntity.realRadius() * 2, trait.x, trait.y)) {
        trait.absorb();
        Fx.absorb.at(trait);
        paramEntity.hit = 1;
    }
});
const blockType = extend(ForceProjector, "invincible-force-projector", {});

lib.setBuildingSimple(blockType, ForceProjector.ForceBuild, {
    updateTile() {
        var phaseValid = this.itemConsumer != null && this.itemConsumer.efficiency(this) > 0;

        this.phaseHeat = Mathf.lerpDelta(this.phaseHeat, Mathf.num(phaseValid), 0.1);

        if (phaseValid && !this.broken && this.timer.get(blockType.timerUse, blockType.phaseUseTime) && this.efficiency > 0) {
            this.consume();
        }

        this.radscl = Mathf.lerpDelta(this.radscl, this.broken ? 0 : this.warmup, 0.05);

        if (Mathf.chanceDelta(this.buildup / this.breakage * 0.1)) {
            Fx.reactorsmoke.at(this.x + Mathf.range(tilesize / 2), this.y + Mathf.range(tilesize / 2));
        }

        this.warmup = Mathf.lerpDelta(this.warmup, this.efficiency, 0.1);

        if (this.buildup > 0) {
            var scale = !this.broken ? cooldownNormal : this.cooldownBrokenBase;
            var cons = this.block.consumes.get(ConsumeType.liquid);
            if (cons.valid(this)) {
                cons.update(this);
                scale *= (cooldownLiquid * (1 + (this.liquids.current().heatCapacity - 0.4) * 0.9));
            }

            this.buildup -= delta() * scale;
        }

        if (this.broken && this.buildup <= 0) {
            this.broken = false;
        }

        if (this.buildup >= this.breakage + this.phaseShieldBoost && !this.broken) {
            this.broken = true;
            this.buildup = this.breakage;
            Fx.shieldBreak.at(this.x, this.y, this.realRadius(), this.team.color);
        }

        if (this.hit > 0) {
            this.hit -= 1 / 5 * Time.delta;
        }

        var realRadius = this.realRadius();

        if (realRadius > 0 && !this.broken) {
            Groups.bullet.intersect(this.x - realRadius, this.y - realRadius, realRadius * 2, realRadius * 2, shieldConsumer(this));
        }
    },
    damage(damage) { },
    handleDamage(tile, amount) { return 0; },
});
