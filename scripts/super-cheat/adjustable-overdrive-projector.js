
const lib = require('super-cheat/lib');

const healed = new IntSet();

(() => {

    function speedToText(speed) {
        var s = speed + "";
        if (s.length > 4) {
            return s.slice(0, s.length - 2);
        } else if (s.length > 2) {
            return s.slice(0, s.length - 2) + '.' + s.slice(s.length - 2, s.length);
        } else if (s.length == 2) {
            return "0." + s;
        } else {
            return "0.0" + s;
        }
    }

    var up1    ;
    var up2    ;
    var up3    ;
    var up4    ;
    var down1  ;
    var down2  ;
    var down3  ;
    var down4  ;

    const MAX = 1000 * 100;
    const MIN = 1;
    // 使用数组下标获取；存储的是乘以 100 的数字
    const commandMap = [1, 10, 100, 1000];

    var lastNumber = 200;

    const range = 120;
    const reload = 30;
    const baseColor = Color.valueOf("feb380");
    const phaseColor = Color.valueOf("ff9ed5");

    const INIT_MASK = 1000000;

    var blockType = extend(Block, "adjustable-overdrive-projector", {
        load() {
            up1 =   lib.loadRegion("up1");
            up2 =   lib.loadRegion("up2");
            up3 =   lib.loadRegion("up3");
            up4 =   lib.loadRegion("up4");
            down1 = lib.loadRegion("down1");
            down2 = lib.loadRegion("down2");
            down3 = lib.loadRegion("down3");
            down4 = lib.loadRegion("down4");
            this.super$load();
        },
        drawPlace(x, y, rotation, valid) {
            const tilesize = Vars.tilesize;
            Drawf.dashCircle(x * tilesize + this.offset, y * tilesize + this.offset, range, Pal.accent);
        },
    });
    blockType.update = true;
    blockType.solid = true;
    blockType.configurable = true;

    lib.setBuilding(blockType, (block) => {
        var heat = 0;
        var charge = 1;
        var phaseHeat = 0;
        // 存储的是乘以 100 的整数
        var speedTo = 200;
        function getHeat() { return heat; };
        function getCharge() { return charge; };
        function getPhaseHeat() { return phaseHeat; };
        function getSpeedTo() { return speedTo; };
        function getSpeedToDecimal() { return speedTo / 100; };
        function getSpeedToText() { return new Packages.java.lang.String(speedToText(speedTo)); };
        function setHeat(v) { heat = v; };
        function setCharge(v) { charge = v; };
        function setPhaseHeat(v) { phaseHeat = v; };
        function setSpeedTo(v) { speedTo = v; };

        return new JavaAdapter(Building, {
            playerPlaced() {
                // 算出最少需要多少次可以达到 lastNumber ，并发送指定次数个 configure
                Core.app.post(run(() => this.configure(lastNumber + INIT_MASK)));
            },
            buildConfiguration(table) {
                table.button(new Packages.arc.scene.style.TextureRegionDrawable(up1), Styles.cleari, run(() => { this.configure(0) })).size(40).tooltip(lib.getMessage("message", "projector-up-1"));
                table.button(new Packages.arc.scene.style.TextureRegionDrawable(up2), Styles.cleari, run(() => { this.configure(1) })).size(40).tooltip(lib.getMessage("message", "projector-up-2"));
                table.button(new Packages.arc.scene.style.TextureRegionDrawable(up3), Styles.cleari, run(() => { this.configure(2) })).size(40).tooltip(lib.getMessage("message", "projector-up-3"));
                table.button(new Packages.arc.scene.style.TextureRegionDrawable(up4), Styles.cleari, run(() => { this.configure(3) })).size(40).tooltip(lib.getMessage("message", "projector-up-4"));
                table.row();
                table.button(new Packages.arc.scene.style.TextureRegionDrawable(down1), Styles.cleari, run(() => { this.configure(100) })).size(40).tooltip(lib.getMessage("message", "projector-down-1"));
                table.button(new Packages.arc.scene.style.TextureRegionDrawable(down2), Styles.cleari, run(() => { this.configure(101) })).size(40).tooltip(lib.getMessage("message", "projector-down-2"));
                table.button(new Packages.arc.scene.style.TextureRegionDrawable(down3), Styles.cleari, run(() => { this.configure(102) })).size(40).tooltip(lib.getMessage("message", "projector-down-3"));
                table.button(new Packages.arc.scene.style.TextureRegionDrawable(down4), Styles.cleari, run(() => { this.configure(103) })).size(40).tooltip(lib.getMessage("message", "projector-down-4"));
            },
            configured(player, value) {
                // 小于 100 视为减小命令，大于 1000000（七位数）视为初始化
                if (value > INIT_MASK) {
                    setSpeedTo(value - INIT_MASK);
                } else if (value >= 100) {
                    var commandVal = commandMap[value - 100];
                    var result = Math.max(MIN, getSpeedTo() - commandVal);
                    setSpeedTo(result);
                    lastNumber = getSpeedTo();
                } else {
                    var commandVal = commandMap[value];
                    var result = Math.min(MAX, getSpeedTo() + commandVal);
                    setSpeedTo(result);
                    lastNumber = getSpeedTo();
                }
            },
            drawLight(){
                Drawf.light(this.team, this.x, this.y, 50 * this.efficiency, baseColor, 0.7 * this.efficiency);
            },
            drawSelect(){
                var realRange = range;
                Vars.indexer.eachBlock(this, realRange, boolf(other => other.block.canOverdrive), cons(other => {
                    var tmp = Tmp.c1.set(baseColor);
                    tmp.a = Mathf.absin(4, 1);
                    Drawf.selected(other, tmp);
                }));
                Drawf.dashCircle(this.x, this.y, realRange, baseColor);
            },
            draw(){
                this.super$draw();
                const tilesize = Vars.tilesize;
                var f = 1 - (Time.time / 100) % 1;

                Draw.color(baseColor, phaseColor, getPhaseHeat());
                Draw.alpha(getHeat() * Mathf.absin(Time.time, 10, 1) * 0.5);
                Draw.rect(this.topRegion, this.tile.drawx(), this.tile.drawy());
                Draw.alpha(1);
                Lines.stroke((2 * f + 0.2) * getHeat());
                Lines.square(this.tile.drawx(), this.tile.drawy(), (1 - f) * 8);

                var font = Fonts.def;
                font.draw(getSpeedToText(), this.x, this.y + 1.5, Color.purple, 0.18, false, Align.center);

                Draw.reset();
            },
            updateTile() {
                const speedBoost = getSpeedToDecimal();
                const duration = reload + 1;
                Vars.indexer.eachBlock(this, range, boolf(other => true), cons(other => {
                    if (speedBoost < 1) {
                        if (speedBoost <= other.timeScale) {
                            other.timeScaleDuration = Math.max(other.timeScaleDuration, duration);
                        }
                        other.applySlowdown(speedBoost, duration);
                    } else {
                        other.applyBoost(speedBoost, duration);
                    }
                }));
            },
            write(writer) {
                this.super$write(writer);
                writer.f(heat);
                writer.f(phaseHeat);
                writer.f(speedTo);
            },
            read(reader, revision) {
                this.super$read(reader, revision);
                heat = reader.f();
                phaseHeat = reader.f();
                speedTo = reader.f();
            },
        });
    });
})();
