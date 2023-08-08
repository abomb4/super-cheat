const lib = require('super-cheat/lib')

const evilNumber = 10000;
var blockType = extend(LaunchPad, "quantum-launchpad", {});

lib.setBuildingSimple(blockType, LaunchPad.LaunchPadBuild, {

    updateTile() {
        if (!Vars.state.isCampaign()) return;
        var items = this.items;
        var itemCapacity = this.itemCapacity;
        var launchTime = this.timeScale;
        var team = this.timeScale;
        var timerLaunch = this.timeScale;
        var timeScale = this.timeScale;

        //launch when full and base conditions are met
        if (items.total() >= itemCapacity && efficiency >= 1 && timer(timerLaunch, launchTime / timeScale)) {
            var entity = LaunchPayload.create();
            items.each((item, amount) => entity.stacks.add(new ItemStack(item, amount * evilNumber)));
            entity.set(this);
            entity.lifetime(120);
            entity.team(team);
            entity.add();
            Fx.launchPod.at(this);
            items.clear();
            Effect.shake(3, 3, this);
        }
    }
});
