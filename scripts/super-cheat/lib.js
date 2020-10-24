
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

exports.aModName = "invincible-cheat-mod-v6";

exports.newEffect = (lifetime, renderer) => new Effect(lifetime, cons(renderer));

exports.cons2 = (func) => new Cons2({
    get: (v1, v2) => func(v1, v2)
});

exports.emptyRegion = Core.atlas.blankAtlas();
exports.loadRegion = function(name) {
    return Core.atlas.find(exports.aModName + '-' + name, Core.atlas.find("clear"))
}

/**
 * @param {Block} blockType The block type
 * @param {(block: Block) => Building} buildingCreator
 *        A function receives block type, return Building instance;
 *        don't use prov (this function will use prov once)
 */
exports.setBuilding = function(blockType, buildingCreator) {
    blockType.buildType = prov(() => buildingCreator(blockType));
}

/**
 * @param {Block} blockType The block type
 * @param {Class<Building>} buildingType The building type
 * @param {Object} overrides Object that as second parameter of extend()
 */
exports.setBuildingSimple = function(blockType, buildingType, overrides) {
    blockType.buildType = prov(() => new JavaAdapter(buildingType, overrides, blockType));
}

/**
 * Get message from bundle.
 * @param {string} type the prefix such as block, unit, mech
 * @param
 */
exports.getMessage = function(type, key) {
    return Core.bundle.get(type + "." + exports.aModName + "." + key);
}
