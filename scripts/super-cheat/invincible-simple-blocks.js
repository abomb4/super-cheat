var lib = require('super-cheat/lib');

lib.setBuildingSimple(extendContent(Wall, "invincible-wall-small", {}), Wall.WallBuild, {
    damage(damage) {  },
    handleDamage(tile, amount) { return 0; },
});
lib.setBuildingSimple(extendContent(Wall, "invincible-wall-medium", {}), Wall.WallBuild, {
    damage(damage) {  },
    handleDamage(tile, amount) { return 0; },
});
lib.setBuildingSimple(extendContent(Wall, "invincible-wall-large", {}), Wall.WallBuild, {
    damage(damage) {  },
    handleDamage(tile, amount) { return 0; },
});
