const lib = require('super-cheat/lib');

const range = 1200;
const warmupSpeed = 0.05;

// Must load region in 'load()'
var topRegion;
var bottomRegion;
var rotatorRegion;

const ORANGE = Color.valueOf("#fea947");

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

const blockType = extend(StorageBlock, "chrono-pusher", {
    load() {
        this.super$load();
        topRegion = lib.loadRegion("chrono-pusher-top");
        bottomRegion = lib.loadRegion("chrono-pusher-bottom");
        rotatorRegion = lib.loadRegion("chrono-pusher-rotator");
    },
    drawPlace(x, y, rotation, valid) {
        Drawf.dashCircle(x * Vars.tilesize, y * Vars.tilesize, range, Pal.accent);
    },
    setBars() {
        this.super$setBars();

        this.barMap.put("capacity", lib.func((e) => new Bar(
            prov(() => Core.bundle.format("bar.capacity", UI.formatAmount(e.block.itemCapacity))),
            prov(() => Pal.items),
            floatp(() => e.items.total() / (e.block.itemCapacity * Vars.content.items().count(boolf(i => i.unlockedNow()))))
        )));
    },
    outputsItems() {
        return false;
    },
    pointConfig(config, transformer) {
        // Rotate relative points
        if (IntSeq.__javaObject__.isInstance(config)) {
            // ROTATE IT!
            let newSeq = new IntSeq(config.size);
            let linkX = null;
            for (let i = 0; i < config.size; i++) {
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
blockType.update = true;
blockType.solid = true;
blockType.hasItems = true;
blockType.configurable = true;
blockType.saveConfig = false;
blockType.itemCapacity = 100;
blockType.noUpdateDisabled = true;
blockType.config(IntSeq, lib.cons2((tile, sq) => {
    // This seems only used by coping block
    let links = new Seq(java.lang.Integer);
    let linkX = null;
    for (let i = 0; i < sq.size; i++) {
        let num = sq.get(i);
        if (linkX == null) {
            linkX = num;
        } else {
            let pos = Point2.pack(linkX + tile.tileX(), num + tile.tileY());
            links.add(lib.int(pos));
            linkX = null;
        }
    }

    tile.setLink(links);
}));
blockType.config(java.lang.Integer, lib.cons2((tile, int) => {
    tile.setOneLink(int);
}));
blockType.configClear(tile => {
    tile.setLink(null);
});

const rdcGroup = new EntityGroup(Building, false, false);
blockType.buildType = prov(() => {

    const MAX_LOOP = 50;
    const FRAME_DELAY = 5;
    const timer = new Interval(6)
    let links = new Seq(java.lang.Integer);
    let deadLinks = new Seq(java.lang.Integer);
    let warmup = 0;
    let rotateDeg = 0;
    let rotateSpeed = 0;

    let consValid = false;
    let itemSent = false;

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
        return target && target.team == the.team && the.within(target, range);
    }

    function linkValid(the, pos) {
        if (pos === undefined || pos === null || pos == -1) return false;
        let linkTarget = Vars.world.build(pos);
        return linkValidTarget(the, linkTarget);
    }

    const tmpWhatHave = [];
    return new JavaAdapter(StorageBlock.StorageBuild, {
        getLink() { return links; },
        setLink(v) {
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
        },
        setOneLink(v) {
            let int = new java.lang.Integer(v);
            if (!links.remove(boolf(i => i == int))) {
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
            if (deadLinks.size >= 50) {
                deadLinks.removeRange(0, 25);
            }
        },
        tryResumeDeadLink(v) {
            if (Vars.net.client()) { return; }
            let int = new java.lang.Integer(v);
            if (!deadLinks.remove(boolf(i => i == int))) {
                return;
            }
            let linkTarget = Vars.world.build(int);
            if (linkValid(this, int)) {
                this.configure(new java.lang.Integer(linkTarget.pos()));
            }
        },
        sendItems(target, whatIHave) {
            let s = false;
            for (let i = whatIHave.length - 1; i >= 0; i--) {
                let have = whatIHave[i];
                let item = have.item;
                let count = have.count;
                let accept = Math.min(count, target.acceptStack(item, Math.min(count, FRAME_DELAY), this));
                if (accept > 0) {
                    s = true;
                    target.handleStack(item, accept, this);
                    this.items.remove(item, accept);
                    have.count -= accept;
                    if (have.count <= 0) {
                        whatIHave.splice(i, 1);
                    }
                }
            }
            return s;
        },
        updateTile() {
            tmpWhatHave.splice(0, tmpWhatHave.length);
            if (timer.get(1, FRAME_DELAY)) {
                itemSent = false;
                consValid = this.efficiency > 0;
                if (consValid) {
                    this.consume()
                    // Build what I have
                    for (let i = 0; i < Vars.content.items().size; i++) {
                        let item = Vars.content.items().get(i);
                        let count = this.items.get(item);
                        if (count > 0) {
                            tmpWhatHave.push({item: item, count: count});
                        }
                    }
                    // Loop connections
                    let max = links.size;
                    for (let i = 0; i < Math.min(MAX_LOOP, max); i++) {
                        let index = looper.next(max);
                        let pos = links.get(index);
                        if (pos === undefined || pos === null || pos == -1) {
                            this.configure(lib.int(pos));
                            continue;
                        }
                        let linkTarget = Vars.world.build(pos);
                        if (!linkValidTarget(this, linkTarget)) {
                            this.deadLink(pos);
                            max -= 1;
                            if (max <= 0) {
                                break;
                            }
                            continue;
                        }
                        if (this.sendItems(linkTarget, tmpWhatHave)) {
                            itemSent = true;
                        }
                    }
                }
            }
            if (consValid) {
                warmup = Mathf.lerpDelta(warmup, links.isEmpty() ? 0 : 1, warmupSpeed);
                rotateSpeed = Mathf.lerpDelta(rotateSpeed, itemSent ? 1 : 0, warmupSpeed);
            } else {
                warmup = Mathf.lerpDelta(warmup, 0, warmupSpeed);
                rotateSpeed = Mathf.lerpDelta(rotateSpeed, 0, warmupSpeed);
            }
            if (warmup > 0) {
                rotateDeg += rotateSpeed;
            }
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

            if (this.enabled && rotateSpeed > 0.5 && Mathf.random(60) > 48) {
                Time.run(Mathf.random(10), run(() => {
                    inEffect.at(this.x, this.y, 0);
                }));
            }
        },
        draw() {
            this.super$draw();
            Draw.alpha(warmup);
            Draw.rect(bottomRegion, this.x, this.y);
            Draw.color();

            Draw.alpha(warmup);
            Draw.rect(rotatorRegion, this.x, this.y, -rotateDeg);

            Draw.alpha(1);
            Draw.rect(topRegion, this.x, this.y);
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
        onConfigureBuildTapped(other) {
            if (this == other) {
                return false;
            }
            if (this.dst(other) <= range && other.team == this.team) {
                this.configure(new java.lang.Integer(other.pos()));
                return false;
            }

            return true;
        },
        config() {
            let output = new IntSeq(links.size * 2);
            // This seems called by coping block
            for (let i = 0; i < links.size; i++) {
                let pos = links.get(i);
                let point2 = Point2.unpack(pos).sub(this.tile.x, this.tile.y);
                output.add(point2.x, point2.y);
            }
            return output;
        },
        acceptStack(item, amount, source) {
            return this.linkedCore == null ?
                this.super$acceptStack(item, amount, source) :
                this.linkedCore.acceptStack(item, amount, source);
        },
        add() {
            if (this.added) { return; }
            rdcGroup.add(this);
            this.super$add();
        },
        remove() {
            if (!this.added) { return; }
            rdcGroup.remove(this);
            this.super$remove();
        },
        write(write) {
            this.super$write(write);
            write.s(links.size);
            let it = links.iterator();
            while (it.hasNext()) {
                let pos = it.next();
                write.i(pos);
            }
        },
        read(read, revision) {
            this.super$read(read, revision);
            links = new Seq(java.lang.Integer);
            let linkSize = read.s();
            for (let i = 0; i < linkSize; i++) {
                let pos = read.i();
                links.add(new java.lang.Integer(pos));
            }
        },
    }, blockType);
});

Events.on(BlockBuildEndEvent, cons(e => {
    if (!e.breaking) {
        rdcGroup.each(cons(cen => {
            cen.tryResumeDeadLink(e.tile.pos());
        }));
    }
}));
