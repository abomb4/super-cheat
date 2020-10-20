const lib = require('super-cheat/lib')

lib.setBuilding(extendContent(Block, "next-wave", {}), (block) => extend(Building, {
    //override the method to build configuration
    buildConfiguration(table) {
        table.button(Icon.upOpen, Styles.clearTransi, run(() => {
            this.configure(0)
        })).size(50).tooltip("Go one wave");
        table.button(Icon.warningSmall, Styles.clearTransi, run(() => {
            this.configure(1)
        })).size(50).tooltip("Go ten wave");
    },

    //override configure event
    configured(player, value) {
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
            }
            default: {
                // print('Unknown config event value ' + value);
            }
        }
    }
}));
