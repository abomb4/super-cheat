const lib = require('super-cheat/lib')

function keep3(num) {
    let numStr = num.toString()
    let index = numStr.indexOf('.')
    return index === -1 ? numStr : numStr.slice(0, index + 4)
}
const landGroup = new EntityGroup(Packages.mindustry.gen.Entityc, false, false)

const landFactory = extend(UnitFactory, 'dps-tester-land-factory', {
    currentArmor: UnitTypes.reign.armor,
    currentHitSize: UnitTypes.reign.hitSize,
})
landFactory.buildVisibility = BuildVisibility.shown
landFactory.size = 3
landFactory.hasPower = false
landFactory.targetable = false
landFactory.health = 65535
landFactory.itemCapacity = 1
landFactory.payloadSpeed = 3
landFactory.category = Category.units

function setArmor(val) {
    landFactory.currentArmor = Math.max(0, val)
    landUnitType.armor = landFactory.currentArmor
}
function setHitSize(val) {
    landFactory.currentHitSize = Math.max(0, val)
    landUnitType.hitSize = landFactory.currentHitSize
}
const CALL_setArmor = (() => {
    const TYPE = 'dpsArmor'

    function makePackage(val) {
        return val + ''
    }
    /**
     * Read packet to objects
     *
     * @param {string} str the packet
     * @returns {{val: number}} contains 3
     */
    function readPackage(str) {
        return {
            val: parseInt(str)
        }
    }

    /** Forwawd to other clients */
    function forwardPackage(pack) {
        Call.clientPacketReliable(TYPE, pack)
    }

    /** Client receives skill active packet, deal self */
    if (Vars.netClient) {
        Vars.netClient.addPacketHandler(TYPE, cons(pack => {
            const info = readPackage(pack)
            if (info.val || info.val === 0) {
                setArmor(info.val)
            }
        }))
    }

    /** Server receives skill active packet, deal self and forward packet */
    Vars.netServer.addPacketHandler(TYPE, lib.cons2((player, pack) => {
        const info = readPackage(pack)
        if (info.val || info.val === 0) {
            setArmor(info.val)
            forwardPackage(pack)
        }
    }))

    return (val) => {
        // const pack = makePackage(val)
        // // Send to EVERY client if i'm server
        // Call.clientPacketReliable(TYPE, pack)
        // // Send to  THE  server if i'm client
        // Call.serverPacketReliable(TYPE, pack)
        // if (!Vars.net.client()) {
        //     setArmor(val)
        // }

        // Armor is no need sync
        setArmor(val)
    }
})()
const CALL_setHitSize = (() => {
    const TYPE = 'dpsHitSize'

    function makePackage(val) {
        return val + ''
    }
    /**
     * Read packet to objects
     *
     * @param {string} str the packet
     * @returns {{val: number}} contains 3
     */
    function readPackage(str) {
        return {
            val: parseInt(str)
        }
    }

    /** Forwawd to other clients */
    function forwardPackage(pack) {
        Call.clientPacketReliable(TYPE, pack)
    }

    /** Client receives skill active packet, deal self */
    if (Vars.netClient) {
        Vars.netClient.addPacketHandler(TYPE, cons(pack => {
            const info = readPackage(pack)
            if (info.val || info.val === 0) {
                setHitSize(info.val)
            }
        }))
    }

    /** Server receives skill active packet, deal self and forward packet */
    Vars.netServer.addPacketHandler(TYPE, lib.cons2((player, pack) => {
        const info = readPackage(pack)
        if (info.val || info.val === 0) {
            setHitSize(info.val)
            forwardPackage(pack)
        }
    }))

    return (val) => {
        const pack = makePackage(val)
        // Send to EVERY client if i'm server
        Call.clientPacketReliable(TYPE, pack)
        // Send to  THE  server if i'm client
        Call.serverPacketReliable(TYPE, pack)
        if (!Vars.net.client()) {
            setHitSize(val)
        }
    }
})()
Events.on(EventType.PlayerConnect, cons(e => {
    CALL_setArmor(landFactory.currentArmor);
    CALL_setHitSize(landFactory.currentHitSize);
}))

lib.setBuildingSimple(landFactory, UnitFactory.UnitFactoryBuild, {
    updateTile() {
        this.currentPlan = 0
        this.super$updateTile()
    },
    buildConfiguration(table) {
        table.button(new Packages.arc.scene.style.TextureRegionDrawable(lib.loadRegion("up1")), Styles.cleari, run(() => {
            CALL_setArmor(landFactory.currentArmor + 1)
        })).size(40).tooltip(lib.getMessage("message", "dps-armor-up"))
        table.button(new Packages.arc.scene.style.TextureRegionDrawable(lib.loadRegion("down1")), Styles.cleari, run(() => {
            CALL_setArmor(landFactory.currentArmor - 1)
        })).size(40).tooltip(lib.getMessage("message", "dps-armor-down"))

        table.button(new Packages.arc.scene.style.TextureRegionDrawable(lib.loadRegion("up2")), Styles.cleari, run(() => {
            CALL_setHitSize(landFactory.currentHitSize + 1)
        })).size(40).tooltip(lib.getMessage("message", "dps-hitsize-up"))
        table.button(new Packages.arc.scene.style.TextureRegionDrawable(lib.loadRegion("down2")), Styles.cleari, run(() => {
            CALL_setHitSize(landFactory.currentHitSize - 1)
        })).size(40).tooltip(lib.getMessage("message", "dps-hitsize-down"))
    },
})

const boardTimeTotal = 60 * 6
const landClassId = 46
const landConstructor = prov(() => new JavaAdapter(MechUnit, {
    dmgRecord: {
        totalOrigin: 0,
        totalReal: 0,
        hits: 0,
        firstHitTime: 0,
        lastHitTime: 0,
        showBoardTime: 0,
    },
    recordDamage(amount, ignoreArmor) {

        const origin = amount
        const real = (ignoreArmor ? amount : Math.max(amount - this.armor, Vars.minArmorDamage * amount)) / this.healthMultiplier
        this.dmgRecord.totalOrigin += origin
        this.dmgRecord.totalReal += real
        this.dmgRecord.hits += 1
        if (this.dmgRecord.firstHitTime == 0) {
            this.dmgRecord.firstHitTime = Time.time
        }
        this.dmgRecord.showBoardTime = boardTimeTotal
        this.dmgRecord.lastHitTime = Time.time
    },
    // -=-=-=
    classId() { return landClassId; },
    update() {
        this.super$update()
        this.armor = landFactory.currentArmor
        this.hitSize = landFactory.currentHitSize
        this.dmgRecord.showBoardTime = Math.max(this.dmgRecord.showBoardTime - Time.delta, 0)
        if (this.dmgRecord.showBoardTime == 0 && this.dmgRecord.totalOrigin > 0) {
            this.dmgRecord.totalOrigin = 0
            this.dmgRecord.totalReal = 0
            this.dmgRecord.hits = 0
            this.dmgRecord.firstHitTime = 0
            this.dmgRecord.lastHitTime = 0
            this.dmgRecord.showBoardTime = 0
        }
    },
    draw() {
        this.super$draw()
        if (this.dmgRecord.showBoardTime > 0) {
            const font = Fonts.def
            var color = Color.yellow.cpy()
            const fontSize = 12 / 60
            const gap = Vars.mobile ? fontSize / 0.04 : fontSize / 0.06
            const x = this.x - 20
            var y = this.y + (Vars.mobile ? 52 : 40)

            var hits = this.dmgRecord.hits
            var gameDuration = this.dmgRecord.lastHitTime - this.dmgRecord.firstHitTime
            var realDuration = gameDuration / 60
            var originDamage = this.dmgRecord.totalOrigin
            var realDamage = this.dmgRecord.totalReal
            var originDps = originDamage / (realDuration == 0 ? 1 : realDuration)
            var realDps = realDamage / (realDuration == 0 ? 1 : realDuration)

            Draw.z(Layer.weather + 1)
            color.a = Math.min(this.dmgRecord.showBoardTime / boardTimeTotal * 3, 1)

			const s = "message.invincible-cheat-mod-v7.dps-info-";
            font.draw(Core.bundle.format(s + "armor", this.armor),                   x, (y -= gap), color, fontSize, false, Align.left)
            font.draw(Core.bundle.format(s + "hitsize", this.hitSize),               x, (y -= gap), color, fontSize, false, Align.left)
            font.draw(Core.bundle.format(s + "hits", hits),                          x, (y -= gap), color, fontSize, false, Align.left)
            font.draw(Core.bundle.format(s + "duration-frame", keep3(gameDuration)), x, (y -= gap), color, fontSize, false, Align.left)
            font.draw(Core.bundle.format(s + "duration-real", keep3(realDuration)),  x, (y -= gap), color, fontSize, false, Align.left)
            font.draw(Core.bundle.format(s + "origin-damage", keep3(originDamage)),  x, (y -= gap), color, fontSize, false, Align.left)
            font.draw(Core.bundle.format(s + "real-damage", keep3(realDamage)),      x, (y -= gap), color, fontSize, false, Align.left)
            font.draw(Core.bundle.format(s + "dps-origin", keep3(originDps)),        x, (y -= gap), color, fontSize, false, Align.left)
            font.draw(Core.bundle.format(s + "dps-real", keep3(realDps)),            x, (y -= gap), color, fontSize, false, Align.left)
            Draw.reset()
        }
    },
    damagePierce(amount, withEffect) {
        var pre = this.hitTime
        this.recordDamage(amount, true)
        if (!withEffect) {
            this.hitTime = pre
        }
    },
    damage(amount, withEffect) {
        if (withEffect === undefined) {
            this.recordDamage(amount, false)
            // this.super$damage(amount)
        } else {
            this.super$damage(amount, withEffect)
        }
    },
    add() {
        if (this.added == true) {
            return
        }
        landGroup.add(this)
        this.super$add()
    },
    remove() {
        if (this.added == false) {
            return
        }
        landGroup.remove(this)
        this.super$remove()
    },
}))
EntityMapping.idMap[landClassId] = landConstructor
const landUnitType = (() => {
    const m = extend(UnitType, 'dps-tester-land', {
    })

    m.constructor = landConstructor

    m.armor = 0
    m.health = 65535
    m.speed = 0.4
    m.rotateSpeed = 2
    m.flying = false
    m.rotateShooting = true
    m.hitSize = 25
    m.destructibleWreck = false
    m.canDrown = false
    m.mechFrontSway = 1
    m.mechStepParticles = true
    m.mechStepShake = 0.15
    m.singleTarget = true
    m.mineSpeed = 50000
    m.mineTier = 2147483647
    m.buildSpeed = Infinity
    m.itemCapacity = 9999
    m.canBoost = true
    m.boostMultiplier = 5
    m.landShake = 4
    m.engineOffset = 12
    m.engineSize = 6
    m.lowAltitude = true
    m.mineWalls = true;
    m.envDisabled = 0;
    return m
})()

landFactory.plans = Seq.with(
    new UnitFactory.UnitPlan(landUnitType, 1, ItemStack.with(Items.graphite, 1))
)
