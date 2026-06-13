const lib = require('super-cheat/lib');

// ══════════════════════════════════════════════════════════════════════
//  smart-filler — 智能填充方块
//
//  警告：此方块深度依赖 Mindustry 内部 API（类层次 instanceof、
//  Java 字段反射式访问、Build 嵌套类引用等）。每个版本更新都有
//  较高概率因类名/继承关系/字段名变动而直接挂掉。
//
//  如果更新后发现不工作，请先检查 Mindustry 的 crash report 中
//  的 "Likely Cause" 是否指向 smart-filler.js。
// ══════════════════════════════════════════════════════════════════════

const range = 27;
const baseColor = Pal.reactorPurple;
const tilesize = Vars.tilesize;
const indexer = Vars.indexer;
const content = Vars.content;
const state = Vars.state;

// ── Per-block-type caches (computed once on ContentInitEvent) ──
const bestItemTurretAmmoMap = {};   // ItemTurret block → { item: Item, dps: float }
const bestLiquidTurretAmmoMap = {}; // LiquidTurret block → { liquid: Liquid, dps: float }
const bestCoolantMap = {};          // block → Liquid (best coolant for any ConsumeLiquidFilter/ConsumeCoolant)
const bestGeneratorFuelMap = {};    // ConsumeGenerator block → { item: Item, score: float }
const bestGeneratorLiquidMap = {};  // ConsumeGenerator block → { liquid: Liquid, score: float }

// ── BulletType DPS estimation ──
// 溅射半径倍率: 3格(24px)=100%, 6格(48px)=200%, 12格(96px)=300%
function splashRadiusMult(radiusPx) {
    if (radiusPx <= 0) return 0;
    var tiles = radiusPx / 8;
    if (tiles < 3) return tiles / 3;
    return 1 + Math.log(tiles / 3) / Math.LN2;
}
// 闪电长度倍率: <10=100%, 20=200%, 40=300%
function lightningLengthMult(length) {
    if (length <= 0 || length < 10) return 1;
    return 1 + Math.log(length / 10) / Math.LN2;
}
// 穿透倍率: 2→200%, 4→200%, 8→300%（递减收益）
function pierceMult(pierce) {
    if (pierce <= 4) return 2.0;
    return 2.0 + (pierce - 4) / 4;
}

// ── 递归计算弹药有效伤害（含穿透/碎片/闪电/spawnUnit嵌套）──
// ammoMultiplier 不计入：它只决定每物品能打几发，不改变单发伤害
function calcBulletEffectiveDamage(bulletType, visited) {
    if (bulletType == null) return 0;
    if (visited == null) visited = [];
    if (visited.indexOf(bulletType) >= 0) return 0;
    visited.push(bulletType);

    // ── 本弹药的原始伤害分量 ──
    var direct = bulletType.damage;
    var splash = 0;
    var lightning = 0;
    var frag = 0;

    if (bulletType.splashDamage > 0 && bulletType.splashDamageRadius > 0) {
        splash = bulletType.splashDamage * splashRadiusMult(bulletType.splashDamageRadius);
    }
    if (bulletType.lightning > 0) {
        var lDmg = bulletType.lightningDamage < 0 ? bulletType.damage : bulletType.lightningDamage;
        lightning = bulletType.lightning * lDmg * lightningLengthMult(bulletType.lightningLength);
    }
    if (bulletType.fragBullet != null && bulletType.fragBullets > 0) {
        var fragEff = calcBulletEffectiveDamage(bulletType.fragBullet, visited);
        frag = fragEff * bulletType.fragBullets * 0.3;
    }

    // ── 本弹药的穿透（只对自身分量生效） ──
    var rawTotal = direct + splash + lightning + frag;
    if (bulletType.pierce) {
        var p = bulletType.pierceCap > 0 ? bulletType.pierceCap : 2;
        var pierceable = direct * 0.2 + (splash + lightning + frag) * 0.5;
        rawTotal += pierceable * (pierceMult(p) - 1);
    }

    // ── spawnUnit 导弹嵌套（独立于本弹药穿透，递归展开） ──
    var spawnDmg = 0;
    if (bulletType.spawnUnit != null) {
        if (bulletType.spawnUnit.deathExplosion != null) {
            spawnDmg += calcBulletEffectiveDamage(bulletType.spawnUnit.deathExplosion, visited);
        }
        var weapons = bulletType.spawnUnit.weapons;
        if (weapons != null && weapons.size > 0) {
            for (var wi = 0; wi < weapons.size; wi++) {
                var w = weapons.get(wi);
                if (w.bullet != null) {
                    spawnDmg += calcBulletEffectiveDamage(w.bullet, visited);
                }
            }
        }
    }

    return rawTotal + spawnDmg;
}

function calcTurretDps(turretBlock, bulletType) {
    // 递归计算弹药有效伤害（穿透/碎片/闪电/spawnUnit 都已计入）
    var effectiveDmg = calcBulletEffectiveDamage(bulletType);

    // 注意：ammoMultiplier 不乘算伤害，只决定每物品能打几发（弹药经济）

    // ── 转换为DPS（考虑射速） ──
    var reloadTicks = turretBlock.reload;
    if (reloadTicks <= 0) reloadTicks = 1;
    var shotsPerSec = 60 / reloadTicks * bulletType.reloadMultiplier;
    return effectiveDmg * shotsPerSec;
}

// ── Find best coolant for a ConsumeLiquidBase ──
function findBestCoolant(coolant) {
    if (coolant instanceof ConsumeLiquidFilter) {
        var coolFilter = coolant.filter;
        var bestCool = null;
        var bestHeatCap = -1;
        var li = content.liquids().iterator();
        while (li.hasNext()) {
            var liquid = li.next();
            if (coolFilter.get(liquid) && liquid.heatCapacity > bestHeatCap) {
                bestHeatCap = liquid.heatCapacity;
                bestCool = liquid;
            }
        }
        return bestCool;
    } else if (coolant instanceof ConsumeLiquid) {
        return coolant.liquid;
    }
    return null;
}

// ── Get best coolant for a block (with cache) ──
function getCachedCoolant(block) {
    var cool = bestCoolantMap[block.id];
    if (cool == null && block.coolant != null) {
        cool = findBestCoolant(block.coolant);
        if (cool != null) bestCoolantMap[block.id] = cool;
    }
    return cool;
}

// ── Initialize caches on ContentInitEvent ──
Events.on(EventType.ContentInitEvent, cons(e => {
    var bi = content.blocks().iterator();
    while (bi.hasNext()) {
        var block = bi.next();

        // ── ItemTurret best ammo ──
        if (block instanceof ItemTurret) {
            var bestItem = null;
            var bestDps = -1;
            var ii = content.items().iterator();
            while (ii.hasNext()) {
                var item = ii.next();
                var bullet = block.ammoTypes.get(item);
                if (bullet == null) continue;
                var dps = calcTurretDps(block, bullet);
                if (dps > bestDps) { bestDps = dps; bestItem = item; }
            }
            if (bestItem != null) bestItemTurretAmmoMap[block.id] = { item: bestItem, dps: bestDps };
        }

        // ── LiquidTurret / ContinuousLiquidTurret best ammo ──
        if (block instanceof LiquidTurret || block instanceof ContinuousLiquidTurret) {
            var bestLiquid = null;
            var bestDps = -1;
            var li = content.liquids().iterator();
            while (li.hasNext()) {
                var liquid = li.next();
                var bullet = block.ammoTypes.get(liquid);
                if (bullet == null) continue;
                var dps = calcTurretDps(block, bullet);
                if (dps > bestDps) { bestDps = dps; bestLiquid = liquid; }
            }
            if (bestLiquid != null) bestLiquidTurretAmmoMap[block.id] = { liquid: bestLiquid, dps: bestDps };
        }

        // ── Turret coolant ──
        if (block instanceof BaseTurret && block.coolant != null) {
            var cool = findBestCoolant(block.coolant);
            if (cool != null) bestCoolantMap[block.id] = cool;
        }

        // ── ConsumeGenerator best fuel (by POWER OUTPUT, not total energy) ──
        if (block instanceof ConsumeGenerator) {
            var filterItem = block.findConsumer(boolf(c => c instanceof ConsumeItemFilter));
            var filterLiquid = block.findConsumer(boolf(c => c instanceof ConsumeLiquidFilter));
            var powerProd = block.powerProduction;

            // Best item fuel: score = powerProduction * efficiencyMultiplier
            // (NOT multiplied by itemDuration/durationMultiplier — we want highest power output, not total energy)
            if (filterItem != null) {
                var bestFuel = null;
                var bestScore = -1;
                var ii = content.items().iterator();
                while (ii.hasNext()) {
                    var item = ii.next();
                    if (!filterItem.filter.get(item)) continue;
                    var effMult = 1;
                    if (filterItem instanceof ConsumeItemEfficiency) {
                        effMult = filterItem.itemEfficiencyMultiplier(item);
                    }
                    var score = powerProd * effMult;
                    if (score > bestScore) { bestScore = score; bestFuel = item; }
                }
                if (bestFuel != null) bestGeneratorFuelMap[block.id] = { item: bestFuel, score: bestScore };
            }

            // Best liquid fuel
            if (filterLiquid != null) {
                var bestLiq = null;
                var bestScore = -1;
                var li = content.liquids().iterator();
                while (li.hasNext()) {
                    var liquid = li.next();
                    if (!filterLiquid.filter.get(liquid)) continue;
                    var effMult = 1;
                    if (typeof filterLiquid.liquidEfficiencyMultiplier === 'function') {
                        effMult = filterLiquid.liquidEfficiencyMultiplier(liquid);
                    }
                    var score = powerProd * effMult;
                    if (score > bestScore) { bestScore = score; bestLiq = liquid; }
                }
                if (bestLiq != null) bestGeneratorLiquidMap[block.id] = { liquid: bestLiq, score: bestScore };
            }
        }

        // ── Cache coolant for non-turret blocks that have ConsumeCoolant ──
        // (e.g. ForceProjector, MendProjector, etc.)
        if (!(block instanceof BaseTurret)) {
            var consumers = block.nonOptionalConsumers;
            for (var ci = 0; ci < consumers.length; ci++) {
                if (consumers[ci] instanceof ConsumeCoolant) {
                    var cool = findBestCoolant(consumers[ci]);
                    if (cool != null) bestCoolantMap[block.id] = cool;
                    break;
                }
            }
            if (bestCoolantMap[block.id] == null) {
                var optCons = block.optionalConsumers;
                for (var ci = 0; ci < optCons.length; ci++) {
                    if (optCons[ci] instanceof ConsumeCoolant) {
                        var cool = findBestCoolant(optCons[ci]);
                        if (cool != null) bestCoolantMap[block.id] = cool;
                        break;
                    }
                }
            }
        }
    }
}));

// ── Helper: fill a liquid into a building ──
function fillLiquid(filler, b, liquid, capacity) {
    if (liquid == null || b.liquids == null) return;
    var fill = (capacity || b.block.liquidCapacity) - b.liquids.get(liquid);
    if (fill > 0.01) b.handleLiquid(filler, liquid, fill);
}

// ── Helper: fill an item into a building ──
function fillItem(b, item, capacity) {
    if (item == null || b.items == null) return;
    var fill = (capacity || b.block.itemCapacity) - b.items.get(item);
    if (fill > 0) b.items.add(item, fill);
}

// ── Lazy cache rebuild: compute on first access if cache miss ──
// Note: Data patches modify block properties directly, so cache rebuild uses current block state.
// We don't clear caches on WorldLoadEvent to avoid crashes during map loading.
function rebuildCacheForBlock(block) {
    // ItemTurret best ammo
    if (block instanceof ItemTurret) {
        var bestItem = null, bestDps = -1;
        var ii = content.items().iterator();
        while (ii.hasNext()) {
            var item = ii.next();
            var bullet = block.ammoTypes.get(item);
            if (bullet == null) continue;
            var dps = calcTurretDps(block, bullet);
            if (dps > bestDps) { bestDps = dps; bestItem = item; }
        }
        if (bestItem != null) bestItemTurretAmmoMap[block.id] = { item: bestItem, dps: bestDps };
    }

    // LiquidTurret / ContinuousLiquidTurret best ammo
    if (block instanceof LiquidTurret || block instanceof ContinuousLiquidTurret) {
        var bestLiquid = null, bestDps = -1;
        var li = content.liquids().iterator();
        while (li.hasNext()) {
            var liquid = li.next();
            var bullet = block.ammoTypes.get(liquid);
            if (bullet == null) continue;
            var dps = calcTurretDps(block, bullet);
            if (dps > bestDps) { bestDps = dps; bestLiquid = liquid; }
        }
        if (bestLiquid != null) bestLiquidTurretAmmoMap[block.id] = { liquid: bestLiquid, dps: bestDps };
    }

    // Turret coolant
    if (block instanceof BaseTurret && block.coolant != null) {
        var cool = findBestCoolant(block.coolant);
        if (cool != null) bestCoolantMap[block.id] = cool;
    }

    // ConsumeGenerator best fuel
    if (block instanceof ConsumeGenerator) {
        var filterItem = block.findConsumer(boolf(c => c instanceof ConsumeItemFilter));
        var filterLiquid = block.findConsumer(boolf(c => c instanceof ConsumeLiquidFilter));
        var powerProd = block.powerProduction;

        if (filterItem != null) {
            var bestFuel = null, bestScore = -1;
            var ii = content.items().iterator();
            while (ii.hasNext()) {
                var item = ii.next();
                if (!filterItem.filter.get(item)) continue;
                var effMult = 1;
                if (filterItem instanceof ConsumeItemEfficiency) {
                    effMult = filterItem.itemEfficiencyMultiplier(item);
                }
                var score = powerProd * effMult;
                if (score > bestScore) { bestScore = score; bestFuel = item; }
            }
            if (bestFuel != null) bestGeneratorFuelMap[block.id] = { item: bestFuel, score: bestScore };
        }

        if (filterLiquid != null) {
            var bestLiq = null, bestScore = -1;
            var li = content.liquids().iterator();
            while (li.hasNext()) {
                var liquid = li.next();
                if (!filterLiquid.filter.get(liquid)) continue;
                var effMult = 1;
                if (typeof filterLiquid.liquidEfficiencyMultiplier === 'function') {
                    effMult = filterLiquid.liquidEfficiencyMultiplier(liquid);
                }
                var score = powerProd * effMult;
                if (score > bestScore) { bestScore = score; bestLiq = liquid; }
            }
            if (bestLiq != null) bestGeneratorLiquidMap[block.id] = { liquid: bestLiq, score: bestScore };
        }
    }

    // Non-turret coolant
    if (!(block instanceof BaseTurret)) {
        var consumers = block.nonOptionalConsumers;
        for (var ci = 0; ci < consumers.length; ci++) {
            if (consumers[ci] instanceof ConsumeCoolant) {
                var cool = findBestCoolant(consumers[ci]);
                if (cool != null) bestCoolantMap[block.id] = cool;
                break;
            }
        }
        if (bestCoolantMap[block.id] == null) {
            var optCons = block.optionalConsumers;
            for (var ci = 0; ci < optCons.length; ci++) {
                if (optCons[ci] instanceof ConsumeCoolant) {
                    var cool = findBestCoolant(optCons[ci]);
                    if (cool != null) bestCoolantMap[block.id] = cool;
                    break;
                }
            }
        }
    }
}

// ── Helper: process a single consumer and fill accordingly ──
function fillConsumer(filler, b, con) {
    var block = b.block;

    if (con instanceof ConsumeItems) {
        // Fixed item list
        var items = con.items;
        for (var i = 0; i < items.length; i++) fillItem(b, items[i].item);

    } else if (con instanceof ConsumeItemDynamic) {
        // Dynamic item list (e.g. UnitFactory, Reconstructor, UnitAssembler)
        try {
            var items = con.items.get(b);
            if (items != null) {
                for (var i = 0; i < items.length; i++) {
                    var cap = (b.getMaximumAccepted && typeof b.getMaximumAccepted === 'function')
                        ? b.getMaximumAccepted(items[i].item) : block.itemCapacity;
                    fillItem(b, items[i].item, cap);
                }
            }
        } catch (e) {
            // Fallback: iterate all items and check block.consumesItem(item)
            var ii = content.items().iterator();
            while (ii.hasNext()) {
                var item = ii.next();
                if (block.consumesItem(item)) {
                    var cap = (b.getMaximumAccepted && typeof b.getMaximumAccepted === 'function')
                        ? b.getMaximumAccepted(item) : block.itemCapacity;
                    fillItem(b, item, cap);
                }
            }
        }

    } else if (con instanceof ConsumeItemFilter) {
        // Filtered items — for generators use cached best fuel, otherwise fill all that pass
        if (b instanceof ConsumeGenerator.ConsumeGeneratorBuild) {
            var fuelInfo = bestGeneratorFuelMap[block.id];
            if (fuelInfo == null) { rebuildCacheForBlock(block); fuelInfo = bestGeneratorFuelMap[block.id]; }
            if (fuelInfo != null) fillItem(b, fuelInfo.item);
        } else if (b instanceof ImpactReactor.ImpactReactorBuild) {
            // ImpactReactor: fill all explosive items
            var ii = content.items().iterator();
            while (ii.hasNext()) {
                var item = ii.next();
                if (con.filter.get(item)) fillItem(b, item);
            }
        } else {
            // Other blocks: fill all accepted items (e.g. phase for boosters)
            var ii = content.items().iterator();
            while (ii.hasNext()) {
                var item = ii.next();
                if (con.filter.get(item)) fillItem(b, item);
            }
        }

    } else if (con instanceof ConsumeLiquids) {
        // Fixed liquid list
        var liquids = con.liquids;
        for (var i = 0; i < liquids.length; i++) fillLiquid(filler, b, liquids[i].liquid);

    } else if (con instanceof ConsumeLiquidsDynamic) {
        // Dynamic liquid list (e.g. UnitAssembler)
        // con.liquids is a Func<Building, LiquidStack[]> — may fail in Rhino due to Java lambda
        try {
            var liquids = con.liquids.get(b);
            if (liquids != null) {
                for (var i = 0; i < liquids.length; i++) fillLiquid(filler, b, liquids[i].liquid);
            }
        } catch (e) {
            // Fallback: iterate all liquids and check block.consumesLiquid(liquid)
            var li = content.liquids().iterator();
            while (li.hasNext()) {
                var liquid = li.next();
                if (block.consumesLiquid(liquid)) fillLiquid(filler, b, liquid);
            }
        }

    } else if (con instanceof ConsumeLiquid) {
        // Single specific liquid
        fillLiquid(filler, b, con.liquid);

    } else if (con instanceof ConsumeCoolant) {
        // Coolant: fill best coolant (highest heatCapacity)
        var cool = bestCoolantMap[block.id];
        if (cool == null) {
            cool = findBestCoolant(con);
            if (cool == null) { rebuildCacheForBlock(block); cool = bestCoolantMap[block.id]; }
            if (cool != null) bestCoolantMap[block.id] = cool;
        }
        fillLiquid(filler, b, cool);

    } else if (con instanceof ConsumeLiquidFilter) {
        // Generic liquid filter — for generators use cached best, otherwise best heatCapacity
        if (b instanceof ConsumeGenerator.ConsumeGeneratorBuild) {
            var liqInfo = bestGeneratorLiquidMap[block.id];
            if (liqInfo == null) { rebuildCacheForBlock(block); liqInfo = bestGeneratorLiquidMap[block.id]; }
            if (liqInfo != null) fillLiquid(filler, b, liqInfo.liquid);
        } else {
            var cool = bestCoolantMap[block.id];
            if (cool == null) {
                cool = findBestCoolant(con);
                if (cool != null) bestCoolantMap[block.id] = cool;
            }
            fillLiquid(filler, b, cool);
        }

    } else if (con instanceof ConsumePayloadDynamic) {
        // UnitAssembler payload requirements
        var payloads = con.payloads.get(b);
        if (payloads != null && b.blocks != null) {
            for (var i = 0; i < payloads.size; i++) {
                var stack = payloads.get(i);
                b.blocks.add(stack.item, stack.amount);
            }
        }
    }
}

// ── Fill logic for a single building ──
function fillBuilding(filler, b) {
    var block = b.block;

    // ── Turrets: special ammo handling ──
    if (b instanceof BaseTurret.BaseTurretBuild) {
        // Fill coolant
        if (block.coolant != null) {
            var cool = getCachedCoolant(block);
            if (cool == null) { rebuildCacheForBlock(block); cool = getCachedCoolant(block); }
            fillLiquid(filler, b, cool);
        }
        // ItemTurret: fill best ammo
        if (b instanceof ItemTurret.ItemTurretBuild) {
            var ammoInfo = bestItemTurretAmmoMap[block.id];
            if (ammoInfo == null) { rebuildCacheForBlock(block); ammoInfo = bestItemTurretAmmoMap[block.id]; }
            if (ammoInfo != null) {
                var item = ammoInfo.item;
                var currentAmmo = b.totalAmmo;
                var maxAmmo = block.maxAmmo;
                var ammoPerItem = block.ammoTypes.get(item) != null ? block.ammoTypes.get(item).ammoMultiplier : 1;
                if (ammoPerItem <= 0) ammoPerItem = 1;
                var itemsNeeded = Math.ceil((maxAmmo - currentAmmo) / ammoPerItem);
                if (itemsNeeded > 0) {
                    b.handleStack(item, Math.min(itemsNeeded, block.itemCapacity), filler);
                }
            }
        }
        // LiquidTurret: fill best ammo liquid (skip wave/tsunami — they have dual use)
        if (b instanceof LiquidTurret.LiquidTurretBuild) {
            if (block.name != "wave" && block.name != "tsunami") {
                var ammoInfo = bestLiquidTurretAmmoMap[block.id];
                if (ammoInfo == null) { rebuildCacheForBlock(block); ammoInfo = bestLiquidTurretAmmoMap[block.id]; }
                if (ammoInfo != null) fillLiquid(filler, b, ammoInfo.liquid);
            }
        }
        // ContinuousLiquidTurret: fill best ammo liquid (sublimate etc.)
        if (block instanceof ContinuousLiquidTurret) {
            var ammoInfo = bestLiquidTurretAmmoMap[block.id];
            if (ammoInfo == null) { rebuildCacheForBlock(block); ammoInfo = bestLiquidTurretAmmoMap[block.id]; }
            if (ammoInfo != null) fillLiquid(filler, b, ammoInfo.liquid);
        }

        // ── Fill other liquid consumers for turrets (e.g. BuildTurret on Erekir consuming nitrogen)
        // These turrets use consumeLiquid but aren't LiquidTurret/ItemTurret, so their liquid
        // consumers are never reached by the generic path (which is skipped via return above).
        // For ContinuousLiquidTurret the ammo liquid is already filled above — skip generic fill.
        for (var ci = 0; ci < block.nonOptionalConsumers.length; ci++) {
            var con = block.nonOptionalConsumers[ci];
            if (con instanceof ConsumeLiquidBase && !(con instanceof ConsumeCoolant)
                && !(block instanceof ContinuousLiquidTurret)) {
                fillConsumer(filler, b, con);
            }
        }

        return;
    }

    // ── Storage / Core: fill all items ──
    if (b instanceof StorageBlock.StorageBuild) {
        if (block.coreMerge && b.linkedCore != null) {
            var core = b.linkedCore;
            var ii = content.items().iterator();
            while (ii.hasNext()) {
                var item = ii.next();
                var fill = core.storageCapacity - core.items.get(item);
                if (fill > 0) {
                    core.items.add(item, fill);
                    if ((Vars.net.server() || !Vars.net.active()) && b.team == state.rules.defaultTeam && state.isCampaign()) {
                        state.rules.sector.info.handleCoreItem(item, fill);
                    }
                }
            }
        } else {
            var ii = content.items().iterator();
            while (ii.hasNext()) {
                var item = ii.next();
                fillItem(b, item);
            }
        }
        return;
    }

    // ── NuclearReactor: special handling (item filter + coolant) ──
    if (b instanceof NuclearReactor.NuclearReactorBuild) {
        // Fill all accepted items (thorium)
        if (b.items != null) {
            var ii = content.items().iterator();
            while (ii.hasNext()) {
                var item = ii.next();
                if (block.consumesItem(item)) fillItem(b, item);
            }
        }
        // Fill coolant
        var consumers = block.nonOptionalConsumers;
        for (var ci = 0; ci < consumers.length; ci++) {
            if (consumers[ci] instanceof ConsumeLiquidBase) {
                fillConsumer(filler, b, consumers[ci]);
            }
        }
        return;
    }

    // ── Neoplasm removal: auto-remove neoplasm from blocks that can explode ──
    // (Cultivator, ConsumeGenerator with explodeOnFull, etc.)
    if (b.liquids != null && block.outputLiquid != null && block.explodeOnFull) {
        var neoplasm = content.liquids().find(boolf(l => l.id == Vars.content.liquid("neoplasm") ? Vars.content.liquid("neoplasm").id : -1));
        // Try to find neoplasm liquid
        var li = content.liquids().iterator();
        while (li.hasNext()) {
            var l = li.next();
            if (l.name == "neoplasm" && b.liquids.get(l) > 0.01) {
                b.liquids.remove(l, b.liquids.get(l));
            }
        }
    }

    // ── GenericCrafter with explodeOnFull: remove neoplasm ──
    if (block instanceof GenericCrafter && block.explodeOnFull && b.liquids != null) {
        var li = content.liquids().iterator();
        while (li.hasNext()) {
            var l = li.next();
            if (l.name == "neoplasm" && b.liquids.get(l) > 0.01) {
                b.liquids.remove(l, b.liquids.get(l));
            }
        }
    }

    // ── Universal consumer-based filling ──
    // Process all non-optional consumers
    var consumers = block.nonOptionalConsumers;
    for (var ci = 0; ci < consumers.length; ci++) {
        fillConsumer(filler, b, consumers[ci]);
    }
    // Process all optional/boost consumers
    var optConsumers = block.optionalConsumers;
    for (var ci = 0; ci < optConsumers.length; ci++) {
        fillConsumer(filler, b, optConsumers[ci]);
    }

    // ── ForceProjector: also fill coolant via its coolantConsumer field ──
    if (b instanceof ForceProjector.ForceBuild && block.coolantConsumer != null) {
        fillConsumer(filler, b, block.coolantConsumer);
    }

    // ── Fallback: directly fill from building plan for dynamic consumers ──
    // ConsumeLiquidsDynamic/ConsumeItemDynamic don't set liquidFilter/itemFilter,
    // so block.consumesLiquid()/consumesItem() returns false for all.
    // Also, calling the Java Func lambda from Rhino may fail.
    // Solution: directly read the plan from known building types.

    if (b instanceof UnitAssembler.UnitAssemblerBuild) {
        // UnitAssembler (Erekir T4/T5)
        try {
            var plan = b.plan();
            if (plan != null) {
                // Items
                if (plan.itemReq != null) {
                    for (var i = 0; i < plan.itemReq.length; i++) {
                        fillItem(b, plan.itemReq[i].item);
                    }
                }
                // Liquids
                if (plan.liquidReq != null) {
                    for (var i = 0; i < plan.liquidReq.length; i++) {
                        fillLiquid(filler, b, plan.liquidReq[i].liquid);
                    }
                }
                // Payloads
                if (plan.requirements != null) {
                    for (var i = 0; i < plan.requirements.size; i++) {
                        var stack = plan.requirements.get(i);
                        b.blocks.add(stack.item, stack.amount);
                    }
                }
            }
        } catch (e) {
            // Fallback: skip plan-based filling if plan() method fails
        }
    } else if (b instanceof UnitFactory.UnitFactoryBuild) {
        // UnitFactory (Serpulo) — uses block.plans[b.currentPlan]
        try {
            if (b.currentPlan != null && b.currentPlan >= 0 && b.currentPlan < block.plans.size) {
                var plan = block.plans.get(b.currentPlan);
                if (plan != null && plan.requirements != null) {
                    for (var i = 0; i < plan.requirements.length; i++) {
                        fillItem(b, plan.requirements[i].item);
                    }
                }
            }
        } catch (e) {
            // Fallback: skip plan-based filling if access fails
        }
    } else if (b instanceof Reconstructor.ReconstructorBuild) {
        // Reconstructor — has fixed requirements, but also uses ConsumeItemDynamic
        // Try to get from consumer
    }

    // ── Generic fallback: fill all items/liquids that block accepts ──
    // IMPORTANT: Do NOT fill all items for generators/reactors — they should only get best fuel!
    var isGenerator = b instanceof ConsumeGenerator.ConsumeGeneratorBuild
        || b instanceof NuclearReactor.NuclearReactorBuild
        || b instanceof ImpactReactor.ImpactReactorBuild;

    if (block.hasItems && b.items != null && !isGenerator) {
        var ii = content.items().iterator();
        while (ii.hasNext()) {
            var item = ii.next();
            if (block.consumesItem(item)) {
                var cap = (b.getMaximumAccepted && typeof b.getMaximumAccepted === 'function')
                    ? b.getMaximumAccepted(item) : block.itemCapacity;
                if (cap <= 0) cap = block.itemCapacity;
                var fill = cap - b.items.get(item);
                if (fill > 0) b.items.add(item, fill);
            }
        }
    }
    if (block.hasLiquids && b.liquids != null) {
        var li = content.liquids().iterator();
        while (li.hasNext()) {
            var liquid = li.next();
            if (block.consumesLiquid(liquid)) {
                fillLiquid(filler, b, liquid);
            }
        }
    }
}

// ── Block definition ──
const blockType = extend(Block, "smart-filler", {
    drawPlace(x, y, rotation, valid) {
        x *= tilesize;
        y *= tilesize;
        Drawf.dashSquare(baseColor, x, y, range * tilesize);
        indexer.eachBlock(Vars.player.team(), Tmp.r1.setCentered(x, y, range * tilesize), b => true, t => {
            var c = Tmp.c1.set(baseColor);
            c.a = Mathf.absin(4, 1);
            Drawf.selected(t, c);
        });
    },
});

blockType.buildType = prov(() => {
    const targets = new Seq();
    var lastChange = -2;
    var timerIdx = blockType.timers++;

    return new JavaAdapter(Building, {
        updateTile() {
            if (!this.timer.get(timerIdx, 5)) return;

            if (lastChange != Vars.world.tileChanges) {
                lastChange = Vars.world.tileChanges;
                targets.clear();
                indexer.eachBlock(this.team, Tmp.r1.setCentered(this.x, this.y, range * tilesize),
                    b => true, b => {
                        if (b.block.hasItems || b.block.hasLiquids) {
                            targets.add(b);
                        }
                    });
            }

            var i = targets.iterator();
            while (i.hasNext()) {
                var t = i.next();
                if (t.health <= 0) continue;
                fillBuilding(this, t);
            }
        },
        drawSelect() {
            Drawf.dashSquare(baseColor, this.x, this.y, range * tilesize);
            indexer.eachBlock(this.team, Tmp.r1.setCentered(this.x, this.y, range * tilesize), b => true, t => {
                var c = Tmp.c1.set(baseColor);
                c.a = Mathf.absin(4, 1);
                Drawf.selected(t, c);
            });
        },
    });
});
