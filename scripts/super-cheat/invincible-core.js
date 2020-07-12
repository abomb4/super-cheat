
const invincibleCore = extendContent(CoreBlock, "invincible-core", {
    canBreak() {
        return Vars.state.teams.cores(Vars.player.team).size > 1;
    },
    handleDamage(tile, amount) { return 0; },
    handleBulletHit(entity, bullet) { },
});
