# super-cheat Mod - AGENTS.md

## Mod Structure
```
super-cheat/
├── mod.hjson                    # Mod metadata (name, version, minGameVersion)
├── content/blocks/*.json        # Block hjson definitions (loaded by ContentParser)
├── scripts/
│   ├── main.js                  # Entry point (required by engine)
│   └── super-cheat/             # Module scripts (require'd by main.js)
│       ├── lib.js               # Shared utilities (modName, setBuilding, etc.)
│       └── *.js                 # Per-block JS logic
├── bundles/
│   ├── bundle.properties        # English (default)
│   ├── bundle_zh_CN.properties  # Chinese
│   └── bundle_ru.properties     # Russian
└── sprites/blocks/              # Block sprites (PNG, named by block internal name)
    └── effects/                 # Effect-category sprites
```

## Loading Order (CRITICAL)
```
1. mod.hjson parsed → mod metadata loaded
2. content/blocks/*.json parsed → Block instances created (type field resolves Java class)
3. sprites/ packed into atlas
4. scripts/main.js executed → all require()'d scripts run
5. Content.init() + postInit() called on all content
6. ContentInitEvent fired ← best place to cache computed data
7. ClientLoadEvent fired ← UI is ready
```

**Key implication**: Scripts run BEFORE ContentInitEvent. So in scripts you can:
- Create blocks with `extend()` or reference hjson-defined blocks
- Set `buildType` to define custom Building behavior
- Register event listeners for ContentInitEvent (to access finalized content like ammoTypes)

But you CANNOT access `block.ammoTypes` etc. at script top-level because content isn't initialized yet.

## HJSON/JSON Block Definitions

### How ContentParser Loads Blocks
- Files in `content/blocks/` (`.json` or `.hjson`) are parsed by `ContentParser`
- `type` field resolves to a Java class: `type: ItemSource` → `mindustry.world.blocks.sandbox.ItemSource`
- If `type` is omitted and a block with same name exists, it's an override
- Block internal name = `modName + "-" + fileNameWithoutExtension` (e.g. `invincible-cheat-mod-v8-cheat-item`)
- Fields are mapped to Java class fields via reflection (snake_case hjson → camelCase Java)
- `consumes: {}` section is parsed separately by `readBlockConsumers()`
- `requirements: []` makes block free; also sets `buildVisibility = shown` if present

### Common Block Types for `type` Field
```
ItemSource / LiquidSource / PowerSource / HeatSource  # Sandbox sources
GenericCrafter / HeatCrafter / AttributeCrafter       # Factories
Drill / BeamDrill                                      # Mining
StorageBlock / CoreBlock                               # Storage
ConsumeGenerator / ThermalGenerator / NuclearReactor   # Power
ItemTurret / LiquidTurret / PowerTurret                # Turrets
OverdriveProjector / MendProjector / ForceProjector    # Projectors
Separator                                              # Processing
```

### When to Use HJSON vs JS-only
- **HJSON only**: Block uses existing Java class with no custom behavior (e.g. HeatSource, ItemSource)
- **HJSON + JS**: Block needs custom Building behavior (override updateTile, draw, etc.)
- **JS-only (extend)**: Block class itself needs overrides (e.g. custom drawPlace, load)

## JavaScript Scripting

### Engine: Rhino (not Node.js)
- `importPackage()` already called for all mindustry packages (see `global.js`)
- `extend(BaseClass, "name", overrides)` → creates new Block subclass
- `JavaAdapter(JavaClass, overrides, constructorArgs...)` → creates instance with method overrides
- `cons(fn)`, `prov(fn)`, `boolf(fn)`, `func(fn)` → create Java functional interface wrappers
- `require('super-cheat/module')` → loads `scripts/super-cheat/module.js` (Rhino module system)

### lib.js Utilities
```javascript
const lib = require('super-cheat/lib');
lib.modName                    // "invincible-cheat-mod-v8"
lib.setBuilding(block, creator)      // block.buildType = prov(() => creator(block))
lib.setBuildingSimple(block, BuildingClass, overrides)
    // block.buildType = prov(() => new JavaAdapter(BuildingClass, overrides, block))
lib.loadRegion(name)           // Core.atlas.find(modName + '-' + name)
lib.getMessage(type, key)      // Core.bundle.get(type + "." + modName + "." + key)
```

### Two Patterns for Custom Blocks

**Pattern A: HJSON defines block, JS adds behavior** (most common)
```javascript
// content/blocks/my-block.json: { type: GenericCrafter, size: 2, ... }
// scripts/super-cheat/my-block.js:
const lib = require('super-cheat/lib');
const block = Vars.content.block("invincible-cheat-mod-v8-my-block");
lib.setBuildingSimple(block, GenericCrafter.GenericCrafterBuild, {
    updateTile() { /* custom logic */ },
});
```

**Pattern B: JS creates block with extend()** (when block class itself needs overriding)
```javascript
const blockType = extend(Block, "my-block", {
    load() { this.super$load(); /* custom load */ },
    drawPlace(x, y, rotation, valid) { /* custom placement preview */ },
});
// Then set building:
lib.setBuilding(blockType, (block) => new JavaAdapter(Building, {
    updateTile() { /* custom logic */ },
}, block));
```

### Accessing Block by Name
```javascript
const block = Vars.content.block("invincible-cheat-mod-v8-my-block");
// Or iterate all blocks:
var iter = Vars.content.blocks().iterator();
while (iter.hasNext()) { var b = iter.next(); /* ... */ }
```

### Bundle Keys Format
```
block.<modName>-<fileName>.name = Display Name
block.<modName>-<fileName>.description = Description text
unit.<modName>-<fileName>.name = Unit Name
message.<modName>-<key> = Message text
```

## Key Events (from EventType.java)

| Event | When | Use Case |
|-------|------|----------|
| `ContentInitEvent` | After all content init+postInit | Cache computed data (best ammo, fuel, etc.) |
| `ClientLoadEvent` | After client fully loaded | UI setup, one-time initialization |
| `WorldLoadEvent` | When a map/game loads | Reset per-world state |
| `ModContentLoadEvent` | After mod hjson parsed, before init | Modify parsed content |
| `BlockDestroyEvent` | Block destroyed | Cleanup |
| `TileChangeEvent` | Tile changed | Cache invalidation (use `Vars.world.tileChanges` counter instead for perf) |

### Performance: tileChanges Counter
```javascript
// Vars.world.tileChanges increments on ANY tile change
// Use as cheap cache invalidation instead of TileChangeEvent
var lastChange = -1;
updateTile() {
    if (lastChange != Vars.world.tileChanges) {
        lastChange = Vars.world.tileChanges;
        // rebuild target list
    }
    // use cached targets
}
```

### Performance: Timer Pattern
```javascript
// Run logic every N ticks instead of every tick
var timerIdx = block.timers++;  // allocate timer slot
updateTile() {
    if (!this.timer.get(timerIdx, 5)) return;  // every 5 ticks
    // ... logic
}
```

## Arc Library Gotchas (no source in repo — these are hard-won lessons)

Arc is Anuken's private framework (`arc.*` packages). Source is NOT in this repo. Below are pitfalls discovered through crashes and trial.

### Arc Collections (arc.struct.*)

| Type | Key Gotcha |
|------|-----------|
| `Seq<T>` | `.size` is a **field** not a method. `seq.size` works, `seq.size()` does NOT. |
| `Seq<T>` | Iterate with `seq.iterator()` + `hasNext()/next()`, or index loop `for(i=0;i<seq.size;i++) seq.get(i)`. JS `for-of` does NOT work. |
| `ObjectMap<K,V>` | `.entries()` returns `ObjectMap$MapIterator` — a **package-private inner class**. Rhino throws `IllegalAccessException` on any access. **NEVER use `.entries()`**. |
| `ObjectMap<K,V>` | `.keys()` also returns `MapIterator` subclass — **ALSO CRASHES** in Rhino! `.keys().toSeq()` does NOT work either. |
| `ObjectMap<K,V>` | Safe iteration: iterate `content.items()/liquids()` + `map.get(key) != null` check. Or use `map.each(cons2((k,v) => ...))` with `lib.cons2()`. |
| `ObjectMap<K,V>` | `.size` is a **field** not a method. |
| `ObjectMap<K,V>` | `.get(key)` is safe — returns null if not found. `.containsKey(key)` is safe. |
| `OrderedMap<K,V>` | Extends `ObjectMap`, same pitfalls. `ammoTypes` is `OrderedMap`. |
| `ObjectSet<T>` | Iterate with `.iterator()`, NOT for-of. `.size` is a field. |
| `IntSet` | `.iterator()` returns `IntSetIterator` (inner class) — same `IllegalAccessException` as ObjectMap! Use `.toSeq()` first. |
| `ObjectFloatMap<K>` | `.entries()` AND `.keys()` same problem as ObjectMap. Safe: iterate known keys + `.get(key, default)`. |

### Block Public Fields (JS can access directly)

| Field/Method | Type | Notes |
|-------------|------|-------|
| `block.hasItems` | `boolean` | Does block hold items? |
| `block.hasLiquids` | `boolean` | Does block hold liquids? |
| `block.itemCapacity` | `int` | Max total item capacity |
| `block.liquidCapacity` | `float` | Max total liquid capacity |
| `block.itemFilter[]` | `boolean[]` | `itemFilter[item.id]` = true → block consumes this item |
| `block.liquidFilter[]` | `boolean[]` | `liquidFilter[liquid.id]` = true → block consumes this liquid |
| `block.consumesItem(Item)` | `boolean` | Method: checks `itemFilter[id]` |
| `block.consumesLiquid(Liquid)` | `boolean` | Method: checks `liquidFilter[id]`. **Requires Liquid param!** No no-arg version! |
| `block.consumers` | `Consume[]` | All consumers (Java array, use `.length` and `[i]`) |
| `block.optionalConsumers` | `Consume[]` | Optional/boost consumers |
| `block.nonOptionalConsumers` | `Consume[]` | Required consumers |
| `block.findConsumer(Boolf<Consume>)` | `Consume` | Find first consumer matching predicate. Use `boolf(c => ...)` |

### Java Arrays in Rhino

| Gotcha | Details |
|--------|---------|
| `.length` not `.size` | Java arrays (e.g. `Consume[]`, `ItemStack[]`) use `.length`, NOT `.size`. `.size` is undefined! |
| `[i]` not `.get(i)` | Java arrays use bracket indexing `arr[i]`, NOT `.get(i)`. `.get()` is undefined! |
| Common arrays | `block.nonOptionalConsumers` → `Consume[]`, `block.optionalConsumers` → `Consume[]`, `ConsumeItems.items` → `ItemStack[]`, `ConsumeLiquids.liquids` → `LiquidStack[]` |

### Arc Functional Interfaces (arc.func.*)

Rhino cannot auto-convert JS functions to Arc's functional interfaces. You MUST use wrappers:
```javascript
cons(fn)    // → new Cons(){ get: fn }
prov(fn)    // → new Prov(){ get: fn }
boolf(fn)   // → new Boolf(){ get: fn }
func(fn)    // → new Func(){ get: fn }
floatf(fn)  // → new Floatf(){ get: fn }
run(fn)     // → new Runnable(){ run: fn }
```
This is already defined in `global.js` but easy to forget when passing lambdas to Java APIs.

### Arc Files (arc.files.Fi)

- `Fi` is NOT `java.io.File`. It's Arc's abstraction over filesystem.
- `Fi.readString()`, `Fi.child("path")`, `Fi.exists()`, `Fi.extension()` are common methods.
- `Core.files` is the entry point for internal files.

### Arc Math (arc.math.*)

- `Mathf` has static math utilities (lerp, clamp, map, etc.)
- `Geom` / `Geometry` for geometric operations
- `Tmp.r1` / `Tmp.v1` etc. are **reusable temp objects** — do NOT store references to them, they get overwritten

### Arc Drawing (arc.graphics.g2d.*)

- `Drawf.dashSquare(color, x, y, size)` for range indicators
- `Draw.rect(region, x, y, rotation)` for block sprites
- `Pal.*` for game palette colors (e.g. `Pal.reactorPurple`)
- `Core.atlas.find(name)` for sprite regions; returns `Core.atlas.find("error")` if not found

### Arc Events (arc.Events)

- `Events.on(EventClass, cons(handler))` — handler MUST be wrapped in `cons()`
- `Events.fire(new SomeEvent())` to fire events
- Events are synchronous; handlers run immediately in fire() call

## Common Pitfalls

1. **`block.ammoTypes` is empty at script load time** — must access in `ContentInitEvent`
2. **`extend()` block name must match hjson filename** — both create the same internal name
3. **`handleLiquid(source, liquid, amount)`** — source must be a Building (use `this` from updateTile)
4. **`items.add(item, amount)` bypasses capacity** — check capacity yourself
5. **`JavaAdapter` only overrides methods** — use `extend()` or set fields directly for properties
6. **Sprite filename = `modName + '-' + blockFileName`** — e.g. `invincible-cheat-mod-v8-smart-filler.png`
7. **`block.timers++` in script top-level** — must happen once, not per building instance
8. **`Seq` iteration** — use `.iterator()` + `.hasNext()`/`.next()`, or index loop; NOT JS for-of
9. **`ObjectMap` iteration** — `.entries()` AND `.keys()` BOTH CRASH with `IllegalAccessException`! Safe: iterate `content.items()/liquids()` + `map.get(key) != null`, or `map.each(lib.cons2((k,v) => ...))`
10. **`instanceof` works** — `b instanceof ItemTurret.ItemTurretBuild` checks Java type
11. **`IntSet.iterator()` CRASHES** — same inner class issue as ObjectMap. Use `.toSeq()` first.
12. **`Tmp.*` temp objects** — `Tmp.r1`, `Tmp.v1` etc. are reused globally. Never store references.
13. **Java arrays** — `Consume[]`, `ItemStack[]` etc. use `.length` and `[i]`, NOT `.size` / `.get(i)`.
14. **`block.coolant` is `ConsumeLiquidBase`** — not necessarily `ConsumeCoolant`. Check `instanceof ConsumeLiquidFilter` before accessing `.filter`.
15. **`BulletType.estimateDPS()` does NOT include lightning damage** — must add `lightning * (lightningDamage < 0 ? damage : lightningDamage) * 0.1` manually.
16. **`BulletType.reloadMultiplier`** — speeds up reload for specific ammo (e.g. Swarm turret). Factor into DPS as `shotsPerSec * reloadMultiplier`.
17. **Generator fuel: power output vs total energy** — `score = powerProduction * efficiencyMultiplier` for highest power output. Do NOT multiply by `itemDuration * itemDurationMultiplier` (that gives total energy, not power).
18. **`ConsumeItemDynamic` / `ConsumeLiquidsDynamic`** — items/liquids are dynamic functions of the building state (e.g. `UnitFactory` plan). Call `con.items.get(b)` / `con.liquids.get(b)` at runtime, not cached.
19. **`ConsumePayloadDynamic`** — `con.payloads.get(b)` returns `Seq<PayloadStack>`. Fill via `b.blocks.add(stack.item, stack.amount)`.
20. **`block.optionalConsumers`** — boost/optional consumers (e.g. phase item for OverdriveProjector, coolant for ForceProjector). Must fill these too!
21. **`ForceProjector.coolantConsumer`** — separate field from `block.coolant`. Access directly as `block.coolantConsumer`.
22. **`block.explodeOnFull`** — `ConsumeGenerator` / `GenericCrafter` with this flag + `outputLiquid` = neoplasm risk. Auto-remove neoplasm liquid.
23. **`UnitFactoryBuild.getMaximumAccepted(item)`** — returns per-item capacity (not `block.itemCapacity`). Use for correct fill amounts.
