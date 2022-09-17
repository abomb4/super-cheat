const lib = require('super-cheat/lib')

lib.setBuilding(extend(Block, "next-wave", {}), (block) => extend(Building, {
    //override the method to build configuration
    buildConfiguration(table) {
        table.button(Icon.upOpen, Styles.cleari, run(() => {
            this.configure(0)
        })).size(50).tooltip(lib.getMessage("message", "next-wave-1"));
        table.button(Icon.warningSmall, Styles.cleari, run(() => {
            this.configure(1)
        })).size(50).tooltip(lib.getMessage("message", "next-wave-10"));
    },

    //override configure event
    configured(player, value) {
        switch (value) {
            case 0: {
                // Evil thing, any one can call next wave
                if (Vars.net.client()) {
                    Call.adminRequest(Vars.player, Packages.mindustry.net.Packets.AdminAction.wave);
                } else {
                    Vars.state.wavetime = 0;
                }
                break;
            }
            case 1: {
                for (var i = 10; i > 0; i--) {
                    if (Vars.net.client()) {
                        Call.adminRequest(Vars.player, Packages.mindustry.net.Packets.AdminAction.wave);
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
