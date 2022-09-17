var lib = require('super-cheat/lib')

function createDpsWall() {
    return {
        displays: [],
        linkAdd(display) {
            if (this.displays.indexOf(display) < 0) {
                this.displays.push(display)
            }
        },
        linkRemove(display) {
            let index = this.displays.indexOf(display)
            if (index >= 0) {
                this.displays.splice(index, 1)
            }
        },
        damage(v1, v2, v3) {
            if (v2 === undefined && v3 === undefined) {
                let amount = v1
                for (let display of this.displays) {
                    display.recordDamage(this, amount)
                }
            } else if (v3 === undefined) {
                this.super$damage(v1, v2)
            } else {
                this.super$damage(v1, v2, v3)
            }
        },
        write(writer) {
            this.super$write(writer);
            writer.s(this.displays.length);
            for (let display of this.displays) {
                writer.i(display.pos());
            }
        },
        read(reader, revision) {
            this.super$read(reader, revision);
            let length = reader.s();
            for (let i = 0; i < length; i++) {
                let pos = reader.i()
                let linkTarget = Vars.world.build(pos);
                if (linkTarget) {
                    this.displays.push(linkTarget)
                }
            }
        },
    }
}

lib.setBuilding(extend(Wall, "dps-wall-1", {}), block => new JavaAdapter(Wall.WallBuild, createDpsWall(), block))
lib.setBuilding(extend(Wall, "dps-wall-2", {}), block => new JavaAdapter(Wall.WallBuild, createDpsWall(), block))
lib.setBuilding(extend(Wall, "dps-wall-3", {}), block => new JavaAdapter(Wall.WallBuild, createDpsWall(), block))
lib.setBuilding(extend(Wall, "dps-wall-4", {}), block => new JavaAdapter(Wall.WallBuild, createDpsWall(), block))
lib.setBuilding(extend(Wall, "dps-wall-5", {}), block => new JavaAdapter(Wall.WallBuild, createDpsWall(), block))

// ------------------------ the display ------------------------

const range = 1200

function keep2(num) {
    let numStr = num.toString()
    let index = numStr.indexOf('.')
    return index === -1 ? numStr : num > 10000000 ? numStr.slice(0, index) : numStr.slice(0, index + 3)
}

const boardTimeTotal = 60 * 6

const DpsWallDisplay = extend(Wall, "dps-wall-display", {

    drawPlace(x, y, rotation, valid) {
        Drawf.dashCircle(x * Vars.tilesize, y * Vars.tilesize, range, Pal.accent);
    },
    pointConfig(config, transformer) {
        // Rotate relative points
        if (IntSeq.__javaObject__.isInstance(config)) {
            // ROTATE IT!
            var newSeq = new IntSeq(config.size);
            var linkX = null;
            for (var i = 0; i < config.size; i++) {
                var num = config.get(i);
                if (linkX == null) {
                    linkX = num;
                } else {
                    // The source position is relative to right bottom, transform it.
                    var point = new Point2(linkX * 2 - 1, num * 2 - 1);

                    transformer.get(point);
                    newSeq.add((point.x + 1) / 2);
                    newSeq.add((point.y + 1) / 2);
                    linkX = null;
                }
            }
            return newSeq;
        } else {
            return config;
        }
    },
})
DpsWallDisplay.config(IntSeq, lib.cons2((tile, sq) => {
    // This seems only used by coping block
    var links = new Seq(java.lang.Integer);
    var linkX = null;
    for (var i = 0; i < sq.size; i++) {
        var num = sq.get(i);
        if (linkX == null) {
            linkX = num;
        } else {
            var pos = Point2.pack(linkX + tile.tileX(), num + tile.tileY());
            links.add(lib.int(pos));
            linkX = null;
        }
    }

    tile.setLink(links);
}));
DpsWallDisplay.config(java.lang.Integer, lib.cons2((tile, int) => {
    tile.setOneLink(int);
}));
DpsWallDisplay.configClear(tile => {
    tile.setLink(null);
});

function isDpsWall(entity) {
    return entity && (
        entity.block.name.indexOf("dps-wall-1") >= 0
        ||
        entity.block.name.indexOf("dps-wall-2") >= 0
        ||
        entity.block.name.indexOf("dps-wall-3") >= 0
        ||
        entity.block.name.indexOf("dps-wall-4") >= 0
        ||
        entity.block.name.indexOf("dps-wall-5") >= 0
    )
}
function linkValid(the, pos) {
    if (pos === undefined || pos === null || pos == -1) return false;
    var linkTarget = Vars.world.build(pos);
    return linkTarget && isDpsWall(linkTarget) && the.within(linkTarget, range);
}
lib.setBuilding(DpsWallDisplay, (block) => new JavaAdapter(Wall.WallBuild, {
    links: new Seq(java.lang.Integer),
    dmgRecord: {
        totalDamage: 0,
        hits: 0,
        firstHitTime: 0,
        lastHitTime: 0,
        showBoardTime: 0,
    },
    getLink() { return this.links },
    setLink(v) { this.links = v },
    setOneLink(v) {
        var int = new java.lang.Integer(v)
        if (!this.links.remove(boolf(i => i == int))) {
            var linkTarget = Vars.world.build(int)
            if (isDpsWall(linkTarget)) {
                this.links.add(int)
                linkTarget.linkAdd(this)
            }
        }
    },
    recordDamage(entity, amount) {
        this.dmgRecord.totalDamage += amount
        this.dmgRecord.hits += 1
        if (this.dmgRecord.firstHitTime == 0) {
            this.dmgRecord.firstHitTime = Time.time
        }
        this.dmgRecord.showBoardTime = boardTimeTotal
        this.dmgRecord.lastHitTime = Time.time
    },
    remove() {
        if (this.added == false) return;
        var it = this.links.iterator();
        while (it.hasNext()) {
            var pos = it.next();
            var linkTarget = Vars.world.build(pos)
            if (isDpsWall(linkTarget)) {
                linkTarget.linkRemove(this)
            }
        }

        this.super$remove();
    },
    updateTile() {
        this.super$updateTile()
        this.dmgRecord.showBoardTime = Math.max(this.dmgRecord.showBoardTime - Time.delta, 0)
        if (this.dmgRecord.showBoardTime == 0 && this.dmgRecord.totalDamage > 0) {
            this.dmgRecord.totalDamage = 0
            this.dmgRecord.hits = 0
            this.dmgRecord.firstHitTime = 0
            this.dmgRecord.lastHitTime = 0
            this.dmgRecord.showBoardTime = 0
        }
    },
    drawConfigure() {
        const tilesize = Vars.tilesize;
        var sin = Mathf.absin(Time.time, 6, 1);

        Draw.color(Pal.accent);
        Lines.stroke(1);
        Drawf.circles(this.x, this.y, (this.tile.block().size / 2 + 1) * Vars.tilesize + sin - 2, Pal.accent);

        for (var i = 0; i < this.links.size; i++) {
            var pos = this.links.get(i);
            if (linkValid(this, pos)) {
                var linkTarget = Vars.world.build(pos);
                Drawf.square(linkTarget.x, linkTarget.y, linkTarget.block.size * tilesize / 2 + 1, Pal.place);
            }
        }
        Drawf.dashCircle(this.x, this.y, range, Pal.accent);
    },
    onConfigureBuildTapped(other) {
        if (this == other) {
            return false;
        }
        if (this.dst(other) <= range && other.team == this.team && isDpsWall(other)) {
            this.configure(new java.lang.Integer(other.pos()));
            return false;
        }

        return true;
    },
    config() {
        var output = new IntSeq(this.links.size * 2);
        // This seems called by coping block
        for (var i = 0; i < this.links.size; i++) {
            var pos = this.links.get(i);
            var point2 = Point2.unpack(pos).sub(this.tile.x, this.tile.y);
            output.add(point2.x, point2.y);
        }
        return output;
    },
    draw() {
        this.super$draw()
        if (this.dmgRecord.showBoardTime > 0) {
            const font = Fonts.def
            var color = Color.yellow.cpy()
            const fontSize = 12 / 60
            const gap = Vars.mobile ? fontSize / 0.04 : fontSize / 0.06
            const x = this.x - 13
            var y = this.y + (Vars.mobile ? 29 : 17)

            var hits = this.dmgRecord.hits
            var gameDuration = this.dmgRecord.lastHitTime - this.dmgRecord.firstHitTime
            var realDuration = gameDuration / 60
            var damage = this.dmgRecord.totalDamage
            var dps = damage / (realDuration == 0 ? 1 : realDuration)

            Draw.z(Layer.weather + 1)
            color.a = Math.min(this.dmgRecord.showBoardTime / boardTimeTotal * 3, 1)
            font.draw("Hits: " + hits, x, (y -= gap), color, fontSize, false, Align.left)
            // font.draw("Duration(frame): " + keep2(gameDuration),    x, (y -= gap), color, fontSize, false, Align.left)
            // font.draw("Duration(seconds): " + keep2(realDuration),  x, (y -= gap), color, fontSize, false, Align.left)
            font.draw("Dmg: " + keep2(damage), x, (y -= gap), color, fontSize, false, Align.left)
            font.draw("DPS: " + keep2(dps), x, (y -= gap), color, fontSize, false, Align.left)
            Draw.reset()
        }
    },
    damage(v1, v2, v3) {
        if (v2 === undefined && v3 === undefined) {
            let amount = v1
            this.recordDamage(this, amount)
        } else if (v3 === undefined) {
            this.super$damage(v1, v2)
        } else {
            this.super$damage(v1, v2, v3)
        }
    },
    write(write) {
        this.super$write(write);
        write.s(this.links.size);
        var it = this.links.iterator();
        while (it.hasNext()) {
            var pos = it.next();
            write.i(pos);
        }
    },
    read(read, revision) {
        this.super$read(read, revision);
        this.links = new Seq(java.lang.Integer);
        var linkSize = read.s();
        for (var i = 0; i < linkSize; i++) {
            var pos = read.i();
            this.links.add(new java.lang.Integer(pos));
        }
    },
}, block))
