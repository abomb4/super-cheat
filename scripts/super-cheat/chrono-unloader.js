const lib = require('super-cheat/lib');

const range = 1200;
const warmupSpeed = 0.05;
const LINK_LIMIT = 32;

// Must load region in 'load()'
let topRegion;
let bottomRegion;
let rotatorRegion;

const BLUE = Color.valueOf("#0068fc");

const outEffect = lib.newEffect(38, e => {
    Draw.color(BLUE);

    Angles.randLenVectors(e.id, 1, 8 * e.fin(), 0, 360, new Floatc2({
        get: (x, y) => {
            let angle = Angles.angle(0, 0, x, y);
            let trnsx = Angles.trnsx(angle, 2);
            let trnsy = Angles.trnsy(angle, 2);
            let trnsx2 = Angles.trnsx(angle, 4);
            let trnsy2 = Angles.trnsy(angle, 4);
            Fill.circle(
                e.x + trnsx + x + trnsx2 * e.fin(),
                e.y + trnsy + y + trnsy2 * e.fin(),
                e.fslope() * 0.8
            );
        }
    }));
});

const blockType = extend(StorageBlock, "chrono-unloader", {
    load() {
        this.super$load();
        topRegion = lib.loadRegion("chrono-unloader-top");
        bottomRegion = lib.loadRegion("chrono-unloader-bottom");
        rotatorRegion = lib.loadRegion("chrono-unloader-rotator");
    },
    init() {
        this.super$init();
        this.acceptsItems = false;
    },
    setStats() {
        this.super$setStats();
        this.stats.add(Stat.powerConnections, LINK_LIMIT, StatUnit.none);
        this.stats.add(Stat.range, range / Vars.tilesize, StatUnit.blocks);
    },
    setBars() {
        this.super$setBars();

        this.barMap.put("capacity", lib.func((e) => new Bar(
            prov(() => Core.bundle.format("bar.capacity", UI.formatAmount(e.block.itemCapacity))),
            prov(() => Pal.items),
            floatp(() => e.items.total() / (e.block.itemCapacity * Vars.content.items().count(boolf(i => i.unlockedNow()))))
        )));
        this.barMap.put("connections", lib.func((e) => new Bar(
            prov(() => Core.bundle.format("bar.powerlines", e.getLinks().size, LINK_LIMIT)),
            prov(() => Pal.items),
            floatp(() => e.getLinks().size / LINK_LIMIT)
        )));
    },
    drawPlace(x, y, rotation, valid) {
        Drawf.dashCircle(x * Vars.tilesize, y * Vars.tilesize, range, Pal.accent);
    },
    outputsItems() {
        return true;
    },
    pointConfig(config, transformer) {
        // Rotate relative points
        if (IntSeq.__javaObject__.isInstance(config)) {
            // ROTATE IT!
            let newSeq = new IntSeq(config.size);
            newSeq.add(config.get(0));
            newSeq.add(config.get(1));
            let linkX = null;
            for (let i = 2; i < config.size; i++) {
                let num = config.get(i);
                if (linkX == null) {
                    linkX = num;
                } else {
                    // The source position is relative to right bottom, transform it.
                    let point = new Point2(linkX * 2 - 1, num * 2 - 1);

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

blockType.buildVisibility = BuildVisibility.shown;
blockType.category = Category.distribution;
blockType.size = 2;
blockType.health = 300;

blockType.update = true;
blockType.solid = true;
blockType.hasItems = true;
blockType.configurable = true;
blockType.saveConfig = false;
blockType.itemCapacity = 100;
blockType.noUpdateDisabled = true;
blockType.requirements = ItemStack.with(
);
blockType.config(IntSeq, lib.cons2((tile, seq) => {
    // This seems only used by coping block
    // Deserialize from IntSeq
    let itemId = seq.get(0)
    let size = seq.get(1);
    let linkX = null;
    let newLinks = new Seq(true, size, java.lang.Integer);
    for (let i = 2; i < seq.size; i++) {
        let num = seq.get(i);
        if (linkX == null) {
            linkX = num;
        } else {
            let point = Point2.pack(linkX + tile.tileX(), num + tile.tileY());
            newLinks.add(lib.int(point));
            linkX = null;
        }
    }
    tile.setItemTypeId(itemId);
    tile.setLinks(newLinks);
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

const theGroup = new EntityGroup(Building, false, false);
blockType.buildType = prov(() => {

    const MAX_LOOP = 8;
    const FRAME_DELAY = 5;
    const timer = new Interval(6)

    let itemType = null;
    let links = new Seq(java.lang.Integer);
    let deadLinks = new Seq(java.lang.Integer);
    let slowdownDelay = 0;
    let warmup = 0;
    let rotateDeg = 0;
    let rotateSpeed = 0;

    let consValid = false;

    const looper = (() => {
        let index = 0;

        return {
            next(max) {
                if (index < 0) {
                    index = max - 1;
                }
                let v = index;
                index -= 1;
                return v;
            },
        }
    })();

    function linkValidTarget(the, target) {
        return target && target.team == the.team && target.items != null && the.within(target, range);
    }

    function linkValid(the, pos) {
        if (pos === undefined || pos === null || pos == -1) return false;
        let linkTarget = Vars.world.build(pos);
        return linkValidTarget(the, linkTarget);
    }

    return new JavaAdapter(StorageBlock.StorageBuild, {
        getLinks() { return links; },
        getItemType() { return itemType; },
        setLinks(v) {
            links = v;
            for (let i = links.size - 1; i >= 0; i--) {
                let link = links.get(i);
                let linkTarget = Vars.world.build(link);
                if (!linkValidTarget(this, linkTarget)) {
                    links.remove(i);
                } else {
                    links.set(i, lib.int(linkTarget.pos()));
                }
            }
            links.truncate(LINK_LIMIT);
        },
        setOneLink(v) {
            let int = new java.lang.Integer(v);
            if (!links.remove(boolf(i => i == int)) && links.size < LINK_LIMIT) {
                links.add(int);
            }
        },
        deadLink(v) {
            // Move to dead link when block disappeared
            if (Vars.net.client()) { return; }
            let int = new java.lang.Integer(v);
            if (links.contains(boolf(i => i == int))) {
                this.configure(int);
            }
            deadLinks.add(int);
            if (deadLinks.size > LINK_LIMIT) {
                deadLinks.remove(0);
            }
        },
        tryResumeDeadLink(v) {
            if (Vars.net.client()) { return; }
            let int = new java.lang.Integer(v);
            if (!deadLinks.remove(boolf(i => i == int))) {
                return;
            }
            if (links.size >= LINK_LIMIT) {
                return;
            }
            let linkTarget = Vars.world.build(int);
            if (linkValid(this, int)) {
                this.configure(new java.lang.Integer(linkTarget.pos()));
            }
        },
        setItemTypeId(v) { itemType = (!v && v !== 0 || v < 0 ? null : Vars.content.items().get(v)) },
        updateTile() {
            let hasItem = false;
            if (timer.get(1, FRAME_DELAY)) {
                if (itemType != null && (consValid = this.efficiency > 0)) {
                    let max = links.size;
                    for (let i = 0; i < Math.min(MAX_LOOP, max); i++) {
                        let index = looper.next(max);
                        let pos = links.get(index);
                        if (pos === undefined || pos === null || pos == -1) {
                            // Delete
                            this.configure(lib.int(pos));
                            continue;
                        }

                        let linkTarget = Vars.world.build(pos);
                        if (!linkValidTarget(this, linkTarget)) {
                            // Clear this link
                            this.deadLink(pos);
                            max -= 1;
                            if (max <= 0) {
                                break;
                            }
                            continue;
                        }

                        let count = linkTarget.items.get(itemType);
                        let accept = Math.min(count, this.acceptStack(itemType, Math.min(count, FRAME_DELAY), linkTarget));

                        if (accept > 0) {
                            this.handleStack(itemType, accept, linkTarget);
                            linkTarget.removeStack(itemType, accept);
                            for (let tmpi = accept; tmpi > 0; tmpi--) {
                                linkTarget.itemTaken(itemType);
                            }
                            hasItem = true;
                        }
                    }
                }

                if (consValid && hasItem) {
                    slowdownDelay = 60;
                } else if (!consValid) {
                    slowdownDelay = 0;
                }

                if (this.enabled && rotateSpeed > 0.5 && Mathf.random(60) > 12) {
                    Time.run(Mathf.random(10), run(() => {
                        outEffect.at(this.x, this.y, 0);
                    }));
                }
                for (let i = 0; i < FRAME_DELAY; i++) {
                    this.dump();
                }
            }
            warmup = Mathf.lerpDelta(warmup, consValid ? 1 : 0, warmupSpeed);
            rotateSpeed = Mathf.lerpDelta(rotateSpeed, slowdownDelay > 0 ? 1 : 0, warmupSpeed);
            slowdownDelay = Math.max(0, slowdownDelay - 1);
            if (warmup > 0) {
                rotateDeg += rotateSpeed;
            }
        },
        display(table) {
            this.super$display(table);
            if (this.items != null) {
                table.row();
                table.left();
                table.table(cons(l => {
                    let map = new ObjectMap();
                    l.update(run(() => {
                        l.clearChildren();
                        l.left();
                        let seq = new Seq(Item);
                        this.items.each(new ItemModule.ItemConsumer({
                            accept(item, amount) {
                                map.put(item, amount);
                                seq.add(item);
                            }
                        }));
                        map.each(lib.cons2((item, amount) => {
                            l.image(item.uiIcon).padRight(3.0);
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
        },
        drawConfigure() {
            const tilesize = Vars.tilesize;
            let sin = Mathf.absin(Time.time, 6, 1);

            Draw.color(Pal.accent);
            Lines.stroke(1);
            Drawf.circles(this.x, this.y, (this.tile.block().size / 2 + 1) * Vars.tilesize + sin - 2, Pal.accent);

            for (let i = 0; i < links.size; i++) {
                let pos = links.get(i);
                if (linkValid(this, pos)) {
                    let linkTarget = Vars.world.build(pos);
                    Drawf.square(linkTarget.x, linkTarget.y, linkTarget.block.size * tilesize / 2 + 1, Pal.place);
                }
            }
            Drawf.dashCircle(this.x, this.y, range, Pal.accent);
        },
        onConfigureBuildTapped(other) {
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
            let seq = new IntSeq(links.size * 2 + 2);
            seq.add(itemType == null ? -1 : itemType.id);
            seq.add(links.size);
            for (let i = 0; i < links.size; i++) {
                let pos = links.get(i);
                let point2 = Point2.unpack(pos).sub(this.tile.x, this.tile.y);
                seq.add(point2.x, point2.y);
            }
            return seq;
        },
        outputsItems() { return true; },
        add() {
            if (this.added) { return; }
            theGroup.add(this);
            this.super$add();
        },
        remove() {
            if (!this.added) { return; }
            theGroup.remove(this);
            this.super$remove();
        },
        version() {
            return 2;
        },
        canDump(to, item) {
            return this.linkedCore == null && !links.contains(boolf(pos => {
                let linkTarget = Vars.world.build(pos);
                return to == linkTarget;
            }));
        },
        acceptItem(source, item) {
            return this.linkedCore != null;
        },
        acceptStack(item, amount, source) {
            if (this.linkedCore != null) {
                return this.linkedCore.acceptStack(item, amount, source);
            } else {
                if (source == null || source.team == this.team) {
                    return Math.min(this.getMaximumAccepted(item) - this.items.get(item), amount);
                } else {
                    return 0;
                }
            }
        },
        write(write) {
            this.super$write(write);
            write.s(itemType == null ? -1 : itemType.id);
            write.s(links.size);
            let it = links.iterator();
            while (it.hasNext()) {
                let pos = it.next();
                write.i(pos);
            }
        },
        read(read, revision) {
            this.super$read(read, revision);
            let id = read.s();
            itemType = id == -1 ? null : Vars.content.items().get(id);
            links = new Seq(java.lang.Integer);
            if (revision == 1) {
                let linkl = read.i();
                links.add(new java.lang.Integer(linkl));
            } else {
                let linkSize = read.s();
                for (let i = 0; i < linkSize; i++) {
                    let pos = read.i();
                    links.add(new java.lang.Integer(pos));
                }
            }
        },
    }, blockType);
});

Events.on(BlockBuildEndEvent, cons(e => {
    if (!e.reaking) {
        theGroup.each(cons(cen => {
            cen.tryResumeDeadLink(e.tile.pos());
        }));
    }
}));

exports.spaceUnloader = blockType;
