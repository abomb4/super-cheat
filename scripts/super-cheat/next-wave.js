//this is NOT the complete definition for this block! see content/blocks/scatter-silo.hjson for the stats and other properties.

//create a simple shockwave effect
const siloLaunchEffect = newEffect(20, e => {
    Draw.color(Color.white, Color.lightGray, e.fin()); //color goes from white to light gray
    Lines.stroke(e.fout() * 3); //line thickness goes from 3 to 0
    Lines.circle(e.x, e.y, e.fin() * 100); //draw a circle whose radius goes from 0 to 100
});

//create the block type
const silo = extendContent(Block, "next-wave", {
    //override the method to build configuration
    buildConfiguration(tile, table) {
        table.addImageButton(Icon.upOpen, Styles.clearTransi, run(() => {
            tile.configure(0)
        })).size(50)
        table.addImageButton(Icon.warningSmall, Styles.clearTransi, run(() => {
            tile.configure(1)
        })).size(50)
        // table.addImageButton(Icon.players, Styles.clearTransi, run(() => {
        //     tile.configure(1)
        // })).size(50)
    },

    //override configure event
    configured(tile, player, value) {
        switch (value) {
            case 0: {
                // Evil thing, any one can call next wave
                if (Vars.net.client()) {
                    Call.onAdminRequest(Vars.player, Packages.mindustry.net.Packets.AdminAction.wave);
                } else {
                    Vars.state.wavetime = 0;
                }
                break;
            }
            case 1: {
                for (var i = 10; i > 0; i--) {
                    if (Vars.net.client()) {
                        Call.onAdminRequest(Vars.player, Packages.mindustry.net.Packets.AdminAction.wave);
                    } else {
                        Vars.logic.runWave();
                    }
                }
                break;

                // // RENEGADE!
                // player.setTeam(player.getTeam() == Team.sharded ? Team.crux : Team.sharded);
                // break;
            }
            default: {
                // print('Unknown config event value ' + value);
            }
        }
    }
})
