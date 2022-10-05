
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

exports.modName = "invincible-cheat-mod-v7";

exports.newEffect = (lifetime, renderer) => new Effect(lifetime, cons(renderer));

exports.cons2 = (func) => new Cons2({ get: (v1, v2) => func(v1, v2) });
exports.floatc2 = (func) => new Floatc2({ get: (v1, v2) => func(v1, v2) });
exports.boolf2 = (func) => new Boolf2({ get: (v1, v2) => func(v1, v2) });
exports.func = (getter) => new Func({ get: getter });
exports.raycaster = (func) => new Geometry.Raycaster({ accept: func });
exports.intc = (func) => new Intc({ get: func });
exports.intc2 = (func) => new Intc2({ get: func });
exports.floatf = (func) => new Floatf({ get: func });

exports.loadRegion = (name) => {
    if (Vars.headless === true) {
        return null
    }
    return Core.atlas.find(exports.modName + '-' + name, "error")
};

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
    return Core.bundle.get(type + "." + exports.modName + "." + key);
}

exports.int = (v) => new java.lang.Integer(v);

exports.createProbabilitySelector = function() {
    const objects = [];
    const probabilities = [];
    var maxProbabilitySum = 0;

    return {
        showProbabilities() {
            const p = [];
            var previous = 0;
            for (var i = 0; i < probabilities.length; i++) {
                var current = probabilities[i];
                p.push(parseFloat(((current - previous) / maxProbabilitySum).toFixed(5)))
                previous = current;
            }
            return p;
        },
        add(obj, probability) {
            if (!Number.isInteger(probability)) {
                throw "'probability' must integer."
            }
            maxProbabilitySum += probability;
            objects.push(obj);
            probabilities.push(maxProbabilitySum);
        },
        random: function() {
            const random = Math.floor(Math.random() * maxProbabilitySum);
            // Can use binary search
            for (var i = 0; i < probabilities.length; i++) {
                var max = probabilities[i];
                if (random < max) {
                    return objects[i];
                }
            }
            throw "IMPOSSIBLE!!! THIS IS A BUG"
        }
    }
}
