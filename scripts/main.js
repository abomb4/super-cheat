
const lib = require('super-cheat/lib')
require('super-cheat/cheat-item')
require('super-cheat/must-die-turret')
require('super-cheat/one-shot-turret')
require('super-cheat/point-turret')
require('super-cheat/enemys-cannot-move')
require('super-cheat/enemys-control')
require('super-cheat/enemys-no-damage')
require('super-cheat/enemys-remove')
require('super-cheat/invincible-core')
require('super-cheat/static-drill')
require('super-cheat/invincible-force-projector')
require('super-cheat/invincible-simple-blocks')
require('super-cheat/next-wave')
require('super-cheat/quantum-launchpad')
require('super-cheat/adjustable-overdrive-projector')
require('super-cheat/chrono-unloader')
require('super-cheat/chrono-pusher')
// require('super-cheat/turret-turret')
require('super-cheat/dps-tester-unit')
require('super-cheat/dps-walls')
require('super-cheat/unit-factory')
require('super-cheat/team-changer')
require('super-cheat/smart-filler')

// Make mod content available on all planets (not just Serpulo)
// Problem: mod blocks are mounted under Serpulo's tech tree (research: "core-shard").
// Planet.init() calls techTree.addPlanet(this) which adds Serpulo to all content's
// shownPlanets in that tree, making isOnPlanet(erekir) return false.
// CoreBlock.postInit() also propagates shownPlanets to associated unit types.
// Solution:
// 1. Clear shownPlanets on ALL mod content so isOnPlanet() returns true for all planets
// 2. Clone mod TechNodes under every other planet's tech tree so they appear in research dialogs
Events.on(EventType.ContentInitEvent, cons(e => {
    const modNamePrefix = lib.modName + '-';

    // Step 1: Clear shownPlanets on all mod UnlockableContent (blocks, units, etc.)
    // When shownPlanets is empty, isOnPlanet() returns true for any planet
    Vars.content.each(cons(content => {
        if (content instanceof UnlockableContent && content.name.startsWith(modNamePrefix)) {
            content.shownPlanets.clear();
        }
    }));

    // Step 2: Create TechNode copies under every other planet's tech tree
    // Collect all mod content that has tech nodes under the original tree
    var modNodes = [];
    for (var i = 0; i < TechTree.all.size; i++) {
        var node = TechTree.all.get(i);
        if (node.content.name.startsWith(modNamePrefix)) {
            modNodes.push(node);
        }
    }

    // Find mod "root" nodes - those whose parent is NOT a mod node
    // These are the entry points of the mod's tech tree into the original planet's tree
    var modRootNodes = [];
    for (var i = 0; i < modNodes.length; i++) {
        var node = modNodes[i];
        if (node.parent == null || !node.parent.content.name.startsWith(modNamePrefix)) {
            modRootNodes.push(node);
        }
    }

    // Save original techNode references before cloning (TechNode constructor overwrites content.techNode)
    var originalTechNodes = new java.util.HashMap();
    for (var i = 0; i < modNodes.length; i++) {
        var node = modNodes[i];
        originalTechNodes.put(node.content, node.content.techNode);
    }

    // Recursively clone a mod subtree under a new parent
    function cloneSubtree(srcNode, newParent, targetPlanet) {
        var content = srcNode.content;
        // Create a new TechNode with empty requirements (cheat mod = free)
        var newNode = new TechTree.TechNode(newParent, content, ItemStack.empty);
        newNode.planet = targetPlanet;

        // Recursively clone children that belong to this mod
        for (var j = 0; j < srcNode.children.size; j++) {
            var child = srcNode.children.get(j);
            if (child.content.name.startsWith(modNamePrefix)) {
                cloneSubtree(child, newNode, targetPlanet);
            }
        }
    }

    // Clone mod subtrees under every other landable planet's tech tree root
    for (var p = 0; p < Vars.content.planets().size; p++) {
        var planet = Vars.content.planets().get(p);
        if (!planet.isLandable() || planet.techTree == null) continue;
        // Skip the planet where mod nodes are already mounted
        if (modRootNodes.length > 0 && modRootNodes[0].rootNode == planet.techTree) continue;

        for (var i = 0; i < modRootNodes.length; i++) {
            cloneSubtree(modRootNodes[i], planet.techTree, planet);
        }
    }

    // Restore original techNode references (point to the original tree nodes)
    // This ensures Objectives.Research.display() works correctly
    var iter = originalTechNodes.entrySet().iterator();
    while (iter.hasNext()) {
        var entry = iter.next();
        entry.getKey().techNode = entry.getValue();
    }

    // Step 3: Make overdrive/shield blocks use square range instead of circular
    // ultra-overdrive is defined in JSON as OverdriveProjector, need to override its building methods
    var ultraOverdrive = Vars.content.block(modNamePrefix + 'ultra-overdrive');
    if (ultraOverdrive != null) {
        var blockRange = ultraOverdrive.range;
        var blockBaseColor = ultraOverdrive.baseColor;

        // Override building methods via setBuildingSimple
        lib.setBuildingSimple(ultraOverdrive, OverdriveProjector.OverdriveBuild, {
            drawSelect() {
                var realRange = blockRange + this.phaseHeat * ultraOverdrive.phaseRangeBoost;
                Vars.indexer.eachBlock(this.team, Tmp.r1.setCentered(this.x, this.y, realRange * 2), boolf(other => other.block.canOverdrive), cons(other => {
                    Drawf.selected(other, Tmp.c1.set(blockBaseColor).a(Mathf.absin(4, 1)));
                }));
                Drawf.dashSquare(blockBaseColor, this.x, this.y, realRange * 2);
            },
            updateTile() {
                this.smoothEfficiency = Mathf.lerpDelta(this.smoothEfficiency, this.efficiency, 0.08);
                this.heat = Mathf.lerpDelta(this.heat, this.efficiency > 0 ? 1 : 0, 0.08);
                this.charge += this.heat * Time.delta;

                if (ultraOverdrive.hasBoost) {
                    this.phaseHeat = Mathf.lerpDelta(this.phaseHeat, this.optionalEfficiency, 0.1);
                }

                if (this.charge >= ultraOverdrive.reload) {
                    var realRange = blockRange + this.phaseHeat * ultraOverdrive.phaseRangeBoost;
                    this.charge = 0;
                    Vars.indexer.eachBlock(this.team, Tmp.r1.setCentered(this.x, this.y, realRange * 2), boolf(other => other.block.canOverdrive), cons(other => {
                        other.applyBoost(this.realBoost(), ultraOverdrive.reload + 1);
                    }));
                }

                if (this.efficiency > 0) {
                    this.useProgress += this.delta();
                }

                if (this.useProgress >= ultraOverdrive.useTime) {
                    this.consume();
                    this.useProgress %= ultraOverdrive.useTime;
                }
            },
        });
    }
}))
