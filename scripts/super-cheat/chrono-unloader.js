const lib = require('super-cheat/lib');

const range = 1200;
const warmupSpeed = 0.05;

// Must load region in 'load()'
var topRegion = lib.emptyRegion;
var bottomRegion = lib.emptyRegion;
var rotatorRegion = lib.emptyRegion;

const ORANGE = Color.valueOf("#fea947");
const BLUE = Color.valueOf("#0068fc");

const inEffect = lib.newEffect(38, e => {
    Draw.color(ORANGE);

    Angles.randLenVectors(e.id, 1, 8 * e.fout(), 0, 360, new Floatc2({
        get: (x, y) => {
            var angle = Angles.angle(0, 0, x, y);
            var trnsx = Angles.trnsx(angle, 2);
            var trnsy = Angles.trnsy(angle, 2);
            var trnsx2 = Angles.trnsx(angle, 4);
            var trnsy2 = Angles.trnsy(angle, 4);
            Fill.circle(
                e.x + trnsx + x + trnsx2 * e.fout(),
                e.y + trnsy + y + trnsy2 * e.fout(),
                e.fslope() * 0.8
            );
        }
    }));
});

const outEffect = lib.newEffect(38, e => {
    Draw.color(BLUE);

    Angles.randLenVectors(e.id, 1, 8 * e.fin(), 0, 360, new Floatc2({
        get: (x, y) => {
            var angle = Angles.angle(0, 0, x, y);
            var trnsx = Angles.trnsx(angle, 2);
            var trnsy = Angles.trnsy(angle, 2);
            var trnsx2 = Angles.trnsx(angle, 4);
            var trnsy2 = Angles.trnsy(angle, 4);
            Fill.circle(
                e.x + trnsx + x + trnsx2 * e.fin(),
                e.y + trnsy + y + trnsy2 * e.fin(),
                e.fslope() * 0.8
            );
        }
    }));
});

const blockType = extendContent(Block, "chrono-unloader", {
    load() {
        this.super$load();
        topRegion = lib.loadRegion("chrono-unloader-top");
        bottomRegion = lib.loadRegion("chrono-unloader-bottom");
        rotatorRegion = lib.loadRegion("chrono-unloader-rotator");
    },
    drawPlace(x, y, rotation, valid) {
        Drawf.dashCircle(x * Vars.tilesize, y * Vars.tilesize, range, Pal.accent);
    },
});
blockType.update = true;
blockType.solid = true;
blockType.hasItems = true;
blockType.configurable = true;
blockType.saveConfig = true;
blockType.itemCapacity = 100;
blockType.noUpdateDisabled = true;
blockType.config(ObjectMap, lib.cons2((tile, map) => {
    tile.setItemTypeId(map.get('itemTypeId'));
    tile.setLink(map.get('link'));
}));
blockType.config(java.lang.Integer, lib.cons2((tile, int) => {
    tile.setLink(int);
}));
blockType.config(Item, lib.cons2((tile, item) => {
    tile.setItemTypeId(item.id);
}));
blockType.configClear(tile => {
    tile.setItemTypeId(null);
});

blockType.buildType = prov(() => {

    var itemType = null;
    var link = -1;
    var warmup = 0;
    var rotateDeg = 0;
    var rotateSpeed = 0;

    function linkValid(the) {
        if (link === undefined || link === null || link == -1) return false;
        var linkTarget = Vars.world.build(link);
        return linkTarget && linkTarget.team == the.team && the.within(linkTarget, range);
    }

    return extend(Building, {
        getLink() { return link; },
        getItemType() { return itemType; },
        setLink(v) { link = v; },
        setItemTypeId(v) { itemType = (v === null ? null : Vars.content.items().get(v)) },
        updateTile() {
            var hasItem = false;
            if (linkValid(this)) {
                var linkTarget = Vars.world.build(this.link);

                if (linkTarget != null && itemType != null) {
                    if (linkTarget.items.has(itemType) && this.items.get(itemType) < this.getMaximumAccepted(itemType)) {
                        this.handleItem(this, itemType);
                        linkTarget.items.remove(itemType, 1);
                        linkTarget.itemTaken(itemType);
                        hasItem = true;
                    }
                }
                warmup = Mathf.lerpDelta(warmup, 1, warmupSpeed);
            } else {
                warmup = Mathf.lerpDelta(warmup, 0, warmupSpeed);
            }
            rotateSpeed = Mathf.lerpDelta(rotateSpeed, hasItem ? 1 : 0, warmupSpeed);
            if (warmup > 0) {
                rotateDeg += rotateSpeed;
            }
            this.dump();
        },
        draw() {
            this.super$draw();
            Draw.color(Color.valueOf('#0a156e'));
            Draw.alpha(warmup);
            Draw.rect(bottomRegion, this.x, this.y);
            Draw.color();

            Draw.alpha(warmup);
            Draw.rect(rotatorRegion, this.x, this.y, rotateDeg);

            Draw.alpha(1);
            Draw.rect(topRegion, this.x, this.y);

            Draw.color(itemType == null ? Color.clear : itemType.color);
            Draw.rect("unloader-center", this.x, this.y);
            Draw.color();


            if (this.enabled && rotateSpeed > 0.5 && Mathf.random(60) > 48) {
                Time.run(Mathf.random(10), run(() => {
                    outEffect.at(this.x, this.y, 0);
                }));
            }
        },
        drawConfigure() {
            const tilesize = Vars.tilesize;
            const x = this.x;
            const y = this.y;
            var sin = Mathf.absin(Time.time(), 6, 1);

            Draw.color(Pal.accent);
            Lines.stroke(1);
            Drawf.circles(this.x, this.y, (this.tile.block().size / 2 + 1) * Vars.tilesize + sin - 2, Pal.accent);

            if (linkValid(this)) {
                var linkTarget = Vars.world.build(link);
                Drawf.circles(linkTarget.x, linkTarget.y, (linkTarget.block.size / 2 + 1) * Vars.tilesize + sin - 2, Pal.place);
                // Drawf.arrow(this.x, this.y, linkTarget.x, linkTarget.y, linkTarget.size * Vars.tilesize + sin, 4 + sin);

                Tmp.v1.set(x + linkTarget.block.offset, y + linkTarget.block.offset)
                      .sub(linkTarget.x, linkTarget.y)
                      .limit((linkTarget.block.size / 2 + 1) * tilesize + sin + 0.5);
                var x2 = x - Tmp.v1.x,
                    y2 = y - Tmp.v1.y,
                    x1 = linkTarget.x + Tmp.v1.x,
                    y1 = linkTarget.y + Tmp.v1.y;
                var segs = (linkTarget.dst(x, y) / tilesize);

                Lines.stroke(4, Pal.gray);
                Lines.dashLine(x1, y1, x2, y2, segs);
                Lines.stroke(2, Pal.placing);
                Lines.dashLine(x1, y1, x2, y2, segs);
            }
            Drawf.dashCircle(this.x, this.y, range, Pal.accent);
        },
        onConfigureTileTapped(other) {
            if (this == other) {
                this.configure(-1);
                return false;
            }

            if (link == other.pos()) {
                this.configure(new java.lang.Integer(-1));
                return false;
            } else if (this.dst(other) <= range && other.team == this.team) {
                this.configure(new java.lang.Integer(other.pos()));
                return false;
            }

            return true;
        },
        buildConfiguration(table) {
            ItemSelection.buildTable(table, Vars.content.items(), prov(() => itemType), cons(v => {
                this.configure(v);
            }));
        },
        config() {
            var map = new ObjectMap(4)
            map.put('itemTypeId', itemType == null ? -1 : itemType.id);
            map.put('link', link);
            return map;
        },
        version() {
            return 1;
        },
        canDump(to, item) {
            var linkTarget = Vars.world.build(this.link);
            return to != linkTarget;
        },
        write(write) {
            this.super$write(write);
            write.s(itemType == null ? -1 : itemType.id);
            write.i(link);
        },
        read(read, revision) {
            this.super$read(read, revision);
            var id = read.s();
            var linkl = read.i();
            itemType = id == -1 ? null : Vars.content.items().get(id);
            link = linkl;
        },
    });
});
