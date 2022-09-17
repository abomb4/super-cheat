var lib = require('super-cheat/lib');
var invincibleShipJs = require('super-cheat/invincible-ship');

const block = extend(CoreBlock, "team-changer", {
    canBreak(tile) { return Vars.state.teams.cores(tile.team()).size > 1; },
    canReplace(other) { return other.alwaysReplace; },
    canPlaceOn(tile, team) { return true; },
    placeBegan(tile, previous) {},
    beforePlaceBegan(tile, previous) {},

    drawPlace(x, y, rotation, valid) {},
});
// block.config(java.lang.Integer, lib.cons2((tile, i) => {
//     tile.team = Team.get(i);
// }));

const allTeams = [
    Team.derelict, Team.sharded, Team.crux,
    Team.green, Team.blue,
];
lib.setBuildingSimple(block, CoreBlock.CoreBuild, {
    damage(damage) {  },
    handleDamage(tile, amount) { return 0; },

    buildConfiguration(table) {
        const tmp = new ImageButton();
        const g = new ButtonGroup(tmp);
        g.remove(tmp);
        const cont = new Table();
        cont.defaults().size(32);
        var i = 0;
        allTeams.forEach(team => {
            (team => {
                var button = cont.button(Tex.whiteui, Styles.clearTogglei, 24, run(() => {
                })).group(g).get();
                button.changed(run(() => {
                    if (button.isChecked()) {
                        this.configure(lib.int(team.id));
                    }
                }));
                button.getStyle().imageUp = Tex.whiteui.tint(team.color.r, team.color.g, team.color.b, team.color.a);
                button.update(run(() => button.setChecked(this.team == team) ));

                if (i++ % 3 == 3) {
                    cont.row();
                }
            })(team);
        });
        // if (i % 3 != 0) {
        //     var remaining = 3 - (i % 3);
        //     for (var j = 0; j < remaining; j++) {
        //         cont.image(Styles.black6);
        //     }
        // }
        var pane = new ScrollPane(cont, Styles.smallPane);
        pane.setScrollingDisabled(true, false);
        pane.setOverscroll(false, false);
        table.add(pane).maxHeight(Scl.scl(40 * 2)).left();
        table.row();
    },
    configured(builder, value) {
        this.super$configured(builder, value);
        if (builder != null && builder.isPlayer()) {
            const team = Team.get(value);
            builder.team = team;
            builder.getPlayer().team(team);

            this.onRemoved();
            this.team = team;
            this.onProximityUpdate();
        }
    },
});
block.unitType = UnitTypes.gamma;
