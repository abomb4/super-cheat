
/**
 * 将某方块变成玩家己方
 *
 * @param {Unit} entity 一般是 tile.ent().target.entity
 */
exports.mindControl = function (targetEntity) {
    var typeName = targetEntity.getClass().getName();
    if (typeName.endsWith("Unit")) {
        var unit = targetEntity.getType().create(Vars.player.getTeam());
        unit.set(targetEntity.x, targetEntity.y);
        unit.add();
        targetEntity.remove();
    } else {
        targetEntity.tile.setTeam(Vars.player.getTeam());
    }
}

exports.loadSound = function (name, setter) {
    const params = new Packages.arc.assets.loaders.SoundLoader.SoundParameter();
    params.loadedCallback = new Packages.arc.assets.AssetLoaderParameters.LoadedCallback({
        finishedLoading(asset, str, cls) {
            // print('1 load sound ' + name + ' from arc');
            setter(asset.get(str, cls));
        }
    });

    Core.assets.load("sounds/" + name, Packages.arc.audio.Sound, params).loaded = new Cons({
        get(a) {
            // print('2 load sound ' + name + ' from arc');
            setter(a);
        }
    });
}

exports.forceProjectRender = function (render) {
    const fakeTile = new Tile(0, 0);
    const x = new JavaAdapter(ForceProjector.ShieldEntity, {
        draw: function() { render() }
    }, null, fakeTile)
    return x;
}

exports.aModName = "invincible-cheat-mod";

exports.playerShield = (() => {

    function initPlayerShield(player) {
    };
    return {
        update(player) {},
    };
})();

exports.loadRegion = function(name) {
    return Core.atlas.find(exports.aModName + '-' + name, Core.atlas.find("clear"))
}
