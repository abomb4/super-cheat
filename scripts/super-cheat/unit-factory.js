
const lib = require('super-cheat/lib');

var teamRegion;
const block = extend(UnitFactory, 'unit-factory', {
    init() {
        this.plans = Vars.content.getBy(ContentType.unit)
            .map(func(unitType => new UnitFactory.UnitPlan(unitType, 1, ItemStack.with(Items.graphite, 1))))
            .filter(boolf(plan => !plan.unit.isHidden()))
        this.super$init();
        this.itemCapacity = 1;
        this.capacities[Items.graphite.id] = 1;
    },
    load() {
        this.super$load();
        teamRegion = lib.loadRegion('unit-factory-team');
    },
});
block.buildVisibility = BuildVisibility.shown;
block.size = 3;
block.hasPower = false;
block.targetable = false;
block.health = 65535;
block.itemCapacity = 1;
block.payloadSpeed = 3;
block.category = Category.units;

block.config(java.lang.Integer, lib.cons2((tile, i) => {
    tile.currentPlan = i < 0 || i >= block.plans.size ? -1 : i;
    tile.progress = 0;
    tile.payload = null;
}));

block.config(UnitType, lib.cons2((tile, val) => {
    tile.currentPlan = block.plans.indexOf(boolf(p => p.unit == val));
    tile.progress = 0;
    tile.payload = null;
}));
block.config(IntSeq, lib.cons2((tile, val) => {
    const i = val.get(0);
    tile.currentPlan = i < 0 || i >= block.plans.size ? -1 : i;
    tile.progress = 0;
    tile.setTargetTeam(Team.get(val.get(1)));
    tile.payload = null;
}));
const allTeams = [
    Team.derelict, Team.sharded, Team.crux,
    Team.green, Team.blue,
];
lib.setBuilding(block, (block) => {

    var targetTeam = Team.sharded;
    return new JavaAdapter(UnitFactory.UnitFactoryBuild, {
        setTargetTeam(team) {
            targetTeam = team;
        },
        init(tile, team, c, d) {
            this.super$init(tile, team, c, d);
            targetTeam = team;
            return this;
        },
        buildConfiguration(table) {
            const tmp = new ImageButton();
            const g = new ButtonGroup(tmp);
            g.remove(tmp);
            const cont = new Table();
            cont.defaults().size(40);
            var i = 0;
            allTeams.forEach(team => {
                (team => {
                    var button = cont.button(Tex.whiteui, Styles.clearTogglei, 24, run(() => {
                    })).group(g).get();
                    button.changed(run(() => targetTeam = (button.isChecked() ? team : null)));
                    button.getStyle().imageUp = Tex.whiteui.tint(team.color.r, team.color.g, team.color.b, team.color.a);
                    button.update(run(() => button.setChecked(targetTeam == team)));

                    if (i++ % 4 == 3) {
                        cont.row();
                    }
                })(team);
            });
            if (i % 4 != 0) {
                var remaining = 4 - (i % 4);
                for (var j = 0; j < remaining; j++) {
                    cont.image(Styles.black6);
                }
            }
            var pane = new ScrollPane(cont, Styles.smallPane);
            pane.setScrollingDisabled(true, false);
            pane.setOverscroll(false, false);
            table.add(pane).maxHeight(Scl.scl(40 * 2)).left();
            table.row();
            this.super$buildConfiguration(table);
        },
        draw() {
            this.super$draw();
            Draw.color(targetTeam.color);
            Draw.rect(lib.loadRegion('unit-factory-team'), this.x, this.y);
        },
        dumpPayload() {
            this.payload.unit.team = targetTeam;
            this.super$dumpPayload();
        },
        config() {
            return IntSeq.with(this.currentPlan, targetTeam.id);
        },
        write(write) {
            this.super$write(write);
            write.b(targetTeam.id);
        },
        read(read, revision) {
            this.super$read(read, revision);
            targetTeam = Team.get(read.b());
        },
    }, block);
});
