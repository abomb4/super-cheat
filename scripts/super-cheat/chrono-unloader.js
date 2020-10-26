const lib = require('super-cheat/lib');

const range = 1200;
const warmupSpeed = 0.05;

// Must load region in 'load()'
var topRegion;
var bottomRegion;
var rotatorRegion;

const BLUE = Color.valueOf("#0068fc");

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
    setBars() {
        this.super$setBars();

        this.bars.add("capacity", lib.func((e) => new Bar(
            prov(() => Core.bundle.format("bar.capacity", UI.formatAmount(e.block.itemCapacity))),
            prov(() => Pal.items),
            floatp(() => e.items.total() / (e.block.itemCapacity * Vars.content.items().count(boolf(i => i.unlockedNow()))))
        )));
    },
    drawPlace(x, y, rotation, valid) {
        Drawf.dashCircle(x * Vars.tilesize, y * Vars.tilesize, range, Pal.accent);
    },
    pointConfig(config, transformer) {
        // Rotate relative points
        if (IntSeq.__javaObject__.isInstance(config)) {
            // ROTATE IT!
            var newSeq = new IntSeq(config.size);
            newSeq.add(config.get(0));
            newSeq.add(config.get(1));
            var linkX = null;
            for (var i = 2; i < config.size; i++) {
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
});
blockType.update = true;
blockType.solid = true;
blockType.hasItems = true;
blockType.configurable = true;
blockType.saveConfig = false;
blockType.itemCapacity = 100;
blockType.noUpdateDisabled = true;
blockType.config(IntSeq, lib.cons2((tile, seq) => {
    // This seems only used by coping block
    // Deserialize from IntSeq
    var itemId = seq.get(0)
    var size = seq.get(1);
    var linkX = null;
    var newLinks = new Seq(true, size, java.lang.Integer);
    for (var i = 2; i < seq.size; i++) {
        var num = seq.get(i);
        if (linkX == null) {
            linkX = num;
        } else {
            var point = Point2.pack(linkX + tile.tileX(), num + tile.tileY());
            newLinks.add(lib.int(point));
            linkX = null;
        }
    }
    tile.setItemTypeId(itemId);
    tile.setLink(newLinks);
}));
blockType.config(java.lang.Integer, lib.cons2((tile, int) => {
    tile.setOneLink(int);
}));
blockType.config(Item, lib.cons2((tile, item) => {
    tile.setItemTypeId(item.id);
}));
blockType.configClear(tile => {
    tile.setItemTypeId(null);
});

blockType.buildType = prov(() => {

    var itemType = null;
    var links = new Seq(java.lang.Integer);
    var warmup = 0;
    var rotateDeg = 0;
    var rotateSpeed = 0;
    var fairLoopOffset = 0;
    function updateFairLoopOffset(max) {
        fairLoopOffset++;
        if (fairLoopOffset >= max) {
            fairLoopOffset = 0;
        }
    }
    function fairLoopIndex(i, max, offset) {
        return (i + offset) % max;
    }

    function linkValid(the, pos) {
        if (pos === undefined || pos === null || pos == -1) return false;
        var linkTarget = Vars.world.build(pos);
        return linkTarget && linkTarget.team == the.team && the.within(linkTarget, range);
    }

    return extend(Building, {
        getLink() { return links; },
        getItemType() { return itemType; },
        setLink(v) { links = v; },
        setOneLink(v) {
            var int = new java.lang.Integer(v);
            if (!links.remove(boolf(i => i == int))) {
                links.add(int);
            }
        },
        setItemTypeId(v) { itemType = (v === null ? null : Vars.content.items().get(v)) },
        updateTile() {
            var hasItem = false;
            if (itemType != null) {
                for (var iloop = 0; iloop < links.size; iloop++) {
                    var i = fairLoopIndex(iloop, links.size, fairLoopOffset);
                    var pos = links.get(i);
                    if (linkValid(this, pos)) {
                        var linkTarget = Vars.world.build(pos);
                        links.set(i, new java.lang.Integer(linkTarget.pos()));

                        if (linkTarget != null && linkTarget.items != null) {
                            if (linkTarget.items.has(itemType) && this.items.get(itemType) < this.getMaximumAccepted(itemType)) {
                                this.handleItem(this, itemType);
                                linkTarget.removeStack(itemType, 1);
                                linkTarget.itemTaken(itemType);
                                hasItem = true;
                            }
                        }
                    } else {
                        // it.remove();
                    }
                }
            }

            warmup = Mathf.lerpDelta(warmup, links.isEmpty() ? 0 : 1, warmupSpeed);
            rotateSpeed = Mathf.lerpDelta(rotateSpeed, hasItem ? 1 : 0, warmupSpeed);
            if (warmup > 0) {
                rotateDeg += rotateSpeed;
            }
            updateFairLoopOffset(links.size);
            this.dump();
        },
        display(table) {
            this.super$display(table);
            if (this.items != null) {
                table.row();
                table.left();
                table.table(cons(l => {
                    var map = new ObjectMap();
                    l.update(run(() => {
                        l.clearChildren();
                        l.left();
                        var seq = new Seq(Item);
                        this.items.each(new ItemModule.ItemConsumer({
                            accept(item, amount) {
                                map.put(item, amount);
                                seq.add(item);
                            }
                        }));
                        map.each(lib.cons2((item, amount) => {
                            l.image(item.icon(Cicon.small)).padRight(3.0);
                            l.label(prov(() => '  ' + Strings.fixed(seq.contains(item) ? amount : 0, 0))).color(Color.lightGray);
                            l.row();
                        }));
                    }));
                })).left();
            }
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
            var sin = Mathf.absin(Time.time(), 6, 1);

            Draw.color(Pal.accent);
            Lines.stroke(1);
            Drawf.circles(this.x, this.y, (this.tile.block().size / 2 + 1) * Vars.tilesize + sin - 2, Pal.accent);

            for (var i = 0; i < links.size; i++) {
                var pos = links.get(i);
                if (linkValid(this, pos)) {
                    var linkTarget = Vars.world.build(pos);
                    Drawf.square(linkTarget.x, linkTarget.y, linkTarget.block.size * tilesize / 2 + 1, Pal.place);
                }
            }
            Drawf.dashCircle(this.x, this.y, range, Pal.accent);
        },
        onConfigureTileTapped(other) {
            if (this == other) {
                this.configure(-1);
                return false;
            }

            if (this.dst(other) <= range && other.team == this.team) {
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
            // Serialize to IntSeq (I don't know how to serialize to byte[], maybe ByteArrayOutputStream?)
            var seq = new IntSeq(links.size * 2 + 2);
            seq.add(itemType == null ? -1 : itemType.id);
            seq.add(links.size);
            for (var i = 0; i < links.size; i++) {
                var pos = links.get(i);
                var point2 = Point2.unpack(pos).sub(this.tile.x, this.tile.y);
                seq.add(point2.x, point2.y);
            }
            return seq;
        },
        version() {
            return 2;
        },
        canDump(to, item) {
            return !links.contains(boolf(pos => {
                var linkTarget = Vars.world.build(pos);
                return to == linkTarget;
            }));
        },
        write(write) {
            this.super$write(write);
            write.s(itemType == null ? -1 : itemType.id);
            write.s(links.size);
            var it = links.iterator();
            while (it.hasNext()) {
                var pos = it.next();
                write.i(pos);
            }
        },
        read(read, revision) {
            this.super$read(read, revision);
            var id = read.s();
            itemType = id == -1 ? null : Vars.content.items().get(id);
            links = new Seq(java.lang.Integer);
            if (revision == 1) {
                var linkl = read.i();
                links.add(new java.lang.Integer(linkl));
            } else {
                var linkSize = read.s();
                for (var i = 0; i < linkSize; i++) {
                    var pos = read.i();
                    links.add(new java.lang.Integer(pos));
                }
            }
        },
    });
});
