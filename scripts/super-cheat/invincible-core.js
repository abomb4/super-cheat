var lib = require('super-cheat/lib');
var invincibleShipJs = require('super-cheat/invincible-ship');

const invincibleCore = extend(CoreBlock, "invincible-core", {
    canBreak(tile) { return Vars.state.teams.cores(tile.team()).size > 1; },
    canReplace(other) { return other.alwaysReplace; },
    canPlaceOn(tile, team) { return true; },
    placeBegan(tile, previous) {},
    beforePlaceBegan(tile, previous) {},

    drawPlace(x, y, rotation, valid) {},
});
lib.setBuildingSimple(invincibleCore, CoreBlock.CoreBuild, {
    damage(damage) {  },
    handleDamage(tile, amount) { return 0; },
});
invincibleCore.unitType = invincibleShipJs.invincibleShip;
