

/**
 * 定义一个多合成工厂 Block 。
 *
 * 资源消耗方面，多合成工厂会直接吞噬材料而不是生产完成后再吞噬材料。
 *
 * @param {{
    *   name: string,              // 方块名称
    *   itemCapacity: number,      // 物品容量
    *   liquidCapacity: number,    // 液体容量
    *   updateEffectChance: number,// 生产效果几率，建议 0.15
    *   updateEffect: Effect,      // 生产效果
    *   ambientSound: Sound,       // 生产声音
    *   ambientSoundVolume: number,// 生产声音大小
    *   draw: (building) => any,   // 自定义绘图方法
    *   plans: {                   // 方案列表
    *     consume: {               // 消费资源
    *       power: number,         // 1 = 60/s
    *       items: { item: Item, amount: number }[],
    *       liquids: { liquid: Liquid, amount: number }[]
    *     },
    *     output: {                // 生产资源
    *       power: number,
    *       items: { item: Item, amount: number },
    *       liquids: { liquid: Liquid, amount: number }
    *     },
    *     craftEffect: Effect,     // 生产效果
    *     craftTime: number,       // 建造时间
    *     boostScale: number,      // 地形加成倍数，1 = 100%
    *     attribute: Attribute,    // 地形加成
    *   }[]
    * }} config 配置项
    *
    * @author 滞人<abomb4@163.com> 2020-11-21
    */
   function defineMultiCrafter(config) {

       function func(getter) { return new Func({ get: getter }); }
       function cons2(fun) { return new Cons2({ get: (v1, v2) => fun(v1, v2) }); }
       function randomLoop(list, func) {
           var randStart = Math.floor(Math.random() * (list.length - 1))
           for (var i = randStart; i < list.length; i++) {
               (v => func(v))(list[i]);
           }
           for (var i = 0; i < randStart; i++) {
               (v => func(v))(list[i]);
           }
       }

       const plans = [];

       var idGen = 0;
       var block;

       const dumpItems = [];
       const dumpLiquids = [];
       for (var i in config.plans) {
           const plan = config.plans[i];
           for (var j in plan.output.items) {
               const item = plan.output.items[j].item;
               if (dumpItems.indexOf(item) < 0) {
                   dumpItems.push(item);
               }
           }
           for (var j in plan.output.liquids) {
               const liquid = plan.output.liquids[j].liquid;
               if (dumpLiquids.indexOf(liquid) < 0) {
                   dumpLiquids.push(liquid);
               }
           }
       }
       const inputItems = [];
       const inputLiquids = [];
       for (var i in config.plans) {
           const plan = config.plans[i];
           for (var j in plan.consume.items) {
               const item = plan.consume.items[j].item;
               if (inputItems.indexOf(item) < 0) {
                   inputItems.push(item);
               }
           }
           for (var j in plan.consume.liquids) {
               const liquid = plan.consume.liquids[j].liquid;
               if (inputLiquids.indexOf(liquid) < 0) {
                   inputLiquids.push(liquid);
               }
           }
       }

       /** 初始化 plan 封装结构 */
       function initPlan(plan) {
           const craftEffect = plan.craftEffect;
           const craftTime = plan.craftTime;
           const boostScale = plan.boostScale;
           const attribute = plan.attribute;

           var id = ++idGen;

           function getData(entity) {
               return entity.getData().planDatas[id];
           }
           function setData(entity, data) {
               return entity.getData().planDatas[id] = data;
           }

           function getAttributeEfficiency(entity) {
               const data = getData(entity);
               const attrSum = data.attrSum;

               if (attribute && boostScale) {
                   return 1 + attrSum * boostScale;
               } else {
                   return 1;
               }
           }

           function getProgressEfficiency(entity) {
               return entity.edelta() * getAttributeEfficiency(entity);
           }

           function getProgressAddition(entity, craftTime) {
               return 1 / craftTime * getProgressEfficiency(entity);
           }

           function getPowerProgressEfficiency(entity) {
               return entity.delta() * getAttributeEfficiency(entity);
           }

           function eat(entity) {
               const data = getData(entity);

               if (data.itemsEaten) { return true; }
               const consumeItems = plan.consume.items;
               if (!consumeItems || consumeItems.length == 0) {
                   return true;
               }
               const items = entity.items;

               var fail = false;
               for (var consume of consumeItems) {
                   var r = (consume => {
                       let item = consume.item;
                       if (!items.has(item, consume.amount)) {
                           fail = true;
                           return fail;
                       }
                   })(consume)
                   if (!r) {
                       break;
                   }
               }
               if (!fail) {
                   for (var consume of consumeItems) {
                       (consume => {
                           let item = consume.item;
                           items.remove(item, consume.amount);

                       })(consume)
                   }
                   data.itemsEaten = true;
                   return true;
               }
               return false;
           }

           function drink(entity) {
               const consumeLiquids = plan.consume.liquids;
               if (!consumeLiquids || consumeLiquids.length == 0) {
                   return true;
               }

               for (var consume of consumeLiquids) {

                   var fls = (consume => {
                       const liquid = consume.liquid;
                       const use = Math.min(consume.amount * getProgressAddition(entity, craftTime), entity.block.liquidCapacity);
                       if (entity.liquids == null || entity.liquids.get(liquid) < use) {
                           return false;
                       }
                   })(consume);
                   if (fls) { return false; }
               }

               for (var consume of consumeLiquids) {

                   (consume => {
                       const liquid = consume.liquid;
                       const use = Math.min(consume.amount * getProgressAddition(entity, craftTime), entity.block.liquidCapacity);
                       entity.liquids.remove(liquid, Math.min(use, entity.liquids.get(liquid)));
                   })(consume)
               }
               return true;
           }

           function doProduce(entity) {
               const data = getData(entity);

               craftEffect.at(entity.getX() + Mathf.range(entity.block.size * 4), entity.getY() + Mathf.range(entity.block.size * 4));
               const outputItems = plan.output.items;
               const outputLiquids = plan.output.liquids;
               const outputPower = plan.output.power;
               if (outputItems) {
                   for (var output of outputItems) {
                       (output => {
                           const item = output.item;
                           const amount = output.amount;
                           for (var j = 0; j < amount; j++) {
                               entity.offload(item);
                           }
                       })(output)
                   }
               }

               if (outputLiquids) {
                   for (var output of outputLiquids) {
                       (output => {
                           const liquid = output.liquid;
                           const amount = output.amount;
                           entity.handleLiquid(entity, liquid, amount);
                       })(output)
                   }
               }

               if (outputPower) {
                   data.powerProduceTime += craftTime;
               }

               data.progress = 0;
               data.itemsEaten = false;
           }

           return {
               getId() { return id; },
               getData() { return plan; },
               update(entity) {
                   const data = getData(entity);
                   data.running = false;

                   // if any outputs full, don't update
                   const outputItems = plan.output.items;
                   const outputLiquids = plan.output.liquids;
                   if (outputItems) {
                       for (var item of outputItems) {
                           if (entity.items.get(item.item) >= entity.block.itemCapacity) {
                               return false;
                           }
                       }
                   }
                   if (outputLiquids) {
                       for (var liquid of outputLiquids) {
                           if (entity.liquids.get(liquid.liquid) >= (entity.block.liquidCapacity - 0.001)) {
                               return false;
                           }
                       }
                   }

                   data.powerProduceTime = Math.max(0, data.powerProduceTime - getPowerProgressEfficiency(entity));
                   if (eat(entity) && drink(entity)) {
                       data.running = true;
                       data.progress += getProgressAddition(entity, craftTime);
                       if (data.progress >= 1) {
                           doProduce(entity);
                       }
                       return true;
                   } else {
                       return false;
                   }
               },
               shouldConsumePower(entity) {
                   const data = getData(entity);
                   const running = data.running;

                   return (plan.consume.power && running) && entity.enabled;
               },
               getPowerProducing(entity) {
                   const data = getData(entity);
                   const powerProduceTime = data.powerProduceTime;

                   return powerProduceTime > 0 && plan.output.power ? plan.output.power * getPowerProgressEfficiency(entity) : 0;
               },
               init(entity) {
                   var data = {
                       progress: 0,
                       running: false,
                       powerProduceTime: 0,
                       attrSum: 0,
                       itemsEaten: false,
                   };
                   if (attribute) {
                       data.attrSum = block.sumAttribute(attribute, entity.tile.x, entity.tile.y);
                   }
                   setData(entity, data);
               }
           };
       }

       config.plans.forEach(v => plans.push(initPlan(v)));

       block = new JavaAdapter(Block, {
           init() {
               plans.forEach(plan => {
                   const power = plan.getData().consume.power;
                   if (power) {
                       this.consumes.powerCond(power, (p => boolf(entity => p.shouldConsumePower(entity)))(plan));
                   }
               });
               this.super$init();
           },
           setStats() {
               this.stats.add(Stat.size, "@x@", this.size, this.size);
               this.stats.add(Stat.health, this.health, StatUnit.none);
               if (this.canBeBuilt()) {
                   this.stats.add(Stat.buildTime, this.buildCost / 60, StatUnit.seconds);
                   this.stats.add(Stat.buildCost, new ItemListValue(false, this.requirements));
               }
               // this.consumes.display(this.stats);

               // Note: Power stats are added by the consumers.
               if (this.hasLiquids) this.stats.add(Stat.liquidCapacity, this.liquidCapacity, StatUnit.liquidUnits);
               if (this.hasItems && this.itemCapacity > 0) this.stats.add(Stat.itemCapacity, this.itemCapacity, StatUnit.items);

               this.stats.add(Stat.output, new JavaAdapter(StatValue, {
                   display: (table) => {
                       table.defaults().padLeft(30).left();
                       for (var plan of config.plans) {
                           ((plan) => {
                               table.row();
                               table.table(cons(table => {
                                   var first = true;
                                   if (plan.consume.items) for (var consume of plan.consume.items) {
                                       if (!first) { table.add(" + ").padRight(4).center().top(); }
                                       (consume => {
                                           const item = consume.item;
                                           const amount = consume.amount;
                                           table.add(amount + '').padRight(4).right().top();
                                           table.image(item.icon(Cicon.medium)).padRight(4).size(3 * 8).left().top();
                                           // table.add(item.localizedName).padRight(4).left().top();
                                       })(consume)
                                       first = false;
                                   }
                                   if (plan.consume.liquids) for (var consume of plan.consume.liquids) {
                                       if (!first) { table.add(" + ").padRight(4).center().top(); }
                                       (consume => {
                                           const liquid = consume.liquid;
                                           const amount = consume.amount;
                                           table.add(amount + '').padRight(4).right().top();
                                           table.image(liquid.icon(Cicon.medium)).padRight(4).size(3 * 8).left().top();
                                           // table.add(liquid.localizedName).padRight(4).left().top();
                                       })(consume);
                                       first = false;
                                   }
                                   if (plan.consume.power) {
                                       if (!first) { table.add(" + ").padRight(4).left().top(); }
                                       table.image(Icon.powerSmall).padRight(4).size(3 * 8).right().top();
                                       table.add(plan.consume.power * 60 + '/s').padRight(4).left().top();
                                   }
                                   table.add(" --> ").padRight(4).left().top();

                                   first = true;
                                   if (plan.output.items) for (var consume of plan.output.items) {
                                       if (!first) { table.add(" + ").padRight(4).center().top(); }
                                       (consume => {
                                           const item = consume.item;
                                           const amount = consume.amount;
                                           table.add(amount + '').padRight(4).right().top();
                                           table.image(item.icon(Cicon.medium)).padRight(4).size(3 * 8).left().top();
                                           // table.add(item.localizedName).padRight(4).left().top();
                                       })(consume)
                                       first = false;
                                   }
                                   if (plan.output.liquids) for (var consume of plan.output.liquids) {
                                       if (!first) { table.add(" + ").padRight(4).center().top(); }
                                       (consume => {
                                           const liquid = consume.liquid;
                                           const amount = consume.amount;
                                           table.add(amount + '').padRight(4).right().top();
                                           table.image(liquid.icon(Cicon.medium)).padRight(4).size(3 * 8).left().top();
                                           // table.add(liquid.localizedName).padRight(4).left().top();
                                       })(consume)
                                       first = false;
                                   }
                                   if (plan.output.power) {
                                       if (!first) { table.add(" + ").padRight(4).center().top(); }
                                       table.image(Icon.powerSmall).padRight(4).size(3 * 8).left().top();
                                       table.add(plan.output.power * 60 + '/s').padRight(4).left().top();
                                   }

                                   table.add(" (").padRight(4).center().top()
                                   table.add((plan.craftTime / 60).toFixed(2)).padRight(4).center().top()
                                   table.add("s)").padRight(4).center().top()
                               }));
                               if (plan.attribute && plan.boostScale) {
                                   table.row();

                                   const stackTable = new Table();
                                   Vars.content.blocks()
                                       .select(boolf(f => f.attributes !== undefined && f.attributes.get(plan.attribute) != 0))
                                       .as().with(cons(s => s.sort(floatf(f => f.attributes.get(plan.attribute)))))
                                       .each(cons(block => {
                                           ((block, plan) => {
                                               const multipler = ((block.attributes.get(plan.attribute) * plan.boostScale) * 100)
                                               stackTable.stack(new Image(block.icon(Cicon.medium)).setScaling(Scaling.fit), new Table(cons(t => {
                                                   t.top().right().add((multipler < 0 ? "[scarlet]" : "[accent]+") + multipler.toFixed(2) + "%").style(Styles.outlineLabel);
                                               })));
                                           })(block, plan);
                                       }));
                                   stackTable.pack();
                                   table.add(stackTable);
                                   table.row();
                                   table.add('').size(8);
                               }
                           })(plan);
                       }
                   }
               }));
           },
           setBars() {
               this.barMap.put("health", func(e => new Bar("stat.health", Pal.health, floatp(() => e.healthf())).blink(Color.white)));

               if (this.hasPower && this.consumes.hasPower()) {
                   var cons = this.consumes.getPower();
                   var buffered = cons.buffered;
                   var capacity = cons.capacity;

                   this.barMap.put("power", func(entity => new Bar(
                       prov(() => buffered ? Core.bundle.format("bar.poweramount", Float.isNaN(entity.power.status * capacity) ? "<ERROR>" : parseInt(entity.power.status * capacity)) : Core.bundle.get("bar.power")),
                       prov(() => Pal.powerBar),
                       floatp(() => Mathf.zero(cons.requestedPower(entity)) && entity.power.graph.getPowerProduced() + entity.power.graph.getBatteryStored() > 0 ? 1 : entity.power.status)
                   )));
               }

               const liquids = new Set(dumpLiquids.concat(inputLiquids));
               if (liquids && liquids.size > 0) {
                   liquids.forEach(liquid => {
                       ((liquid) => {
                           this.barMap.put(liquid.name, func((e) => new Bar(
                               // prov(() => liquid.localizedName + ": " + UI.formatAmount(e.liquids.get(liquid)) + ' / ' + UI.formatAmount(e.block.liquidapacity)),
                               // prov(() => Color.acid),
                               liquid.localizedName,
                               liquid.barColor == null ? liquid.color : liquid.barColor,
                               floatp(() => e.liquids.get(liquid) / e.block.liquidCapacity)
                           )));
                       })(liquid);
                   });
               }
           },
       }, config.name);
       block.hasItems = true;
       block.hasLiquids = true;
       block.hasPower = true;
       block.update = true;
       block.solid = true;
       block.outputsLiquid = true;
       block.outputsPower = true;
       block.consumesPower = true;
       block.ambientSound = config.ambientSound || Sounds.machine;
       block.ambientSoundVolume = config.ambientSound || 0.05;
       block.sync = true;
       block.itemCapacity = config.itemCapacity;
       block.liquidCapacity = config.liquidCapacity;
       block.flags = EnumSet.of(BlockFlag.factory);

       const updateEffectChance = config.updateEffectChance || 0.04;
       const updateEffect = config.updateEffect || Fx.none;

       block.buildType = prov(() => {
           var data = {
               warmup: 0,
               planDatas: {},
           };
           var updated = false;

           const entity = new JavaAdapter(Building, {
               getData() { return data; },
               init(tile, team, shouldAdd, rotation) {
                   this.super$init(tile, team, shouldAdd, rotation);
                   plans.forEach(plan => plan.init(this));
                   return this;
               },
               draw() {
                   if (config.draw) {
                       config.draw(this);
                   } else {
                       this.super$draw();
                   }
               },
               // display(table) {
               //     // Show item count
               //     this.super$display(table);
               //     if (this.items != null) {
               //         table.row();
               //         table.left();
               //         table.table(cons(l => {
               //             var map = new ObjectMap();
               //             l.update(run(() => {
               //                 l.clearChildren();
               //                 l.left();
               //                 var seq = new Seq(Item);
               //                 this.items.each(new ItemModule.ItemConsumer({
               //                     accept(item, amount) {
               //                         map.put(item, amount);
               //                         seq.add(item);
               //                     }
               //                 }));
               //                 map.each(cons2((item, amount) => {
               //                     l.image(item.uiIcon).padRight(3.0);
               //                     l.label(prov(() => '  ' + Strings.fixed(seq.contains(item) ? amount : 0, 0))).color(Color.lightGray);
               //                     l.row();
               //                 }));
               //             }));
               //         })).left();
               //     }
               // },
               acceptItem(source, item) {
                   return inputItems.indexOf(item) >= 0 && this.items.get(item) < this.getMaximumAccepted(item);
               },
               acceptLiquid(source, liquid) {
                   return inputLiquids.indexOf(liquid) >= 0;
               },
               shouldAmbientSound() {
                   return updated;
               },
               updateTile() {
                   var updated = false;
                   if (this.consValid()) {
                       randomLoop(plans, plan => {
                           if (plan.update(this)) {
                               updated = true;
                           }
                       });
                       if (updated) {
                           // This should be only power
                           this.consume();
                           data.warmup = Mathf.lerpDelta(data.warmup, 1, 0.02);
                           if (Mathf.chanceDelta(updateEffectChance)) {
                               updateEffect.at(this.getX() + Mathf.range(block.size * 4), this.getY() + Mathf.range(block.size * 4));
                           }
                       } else {
                           data.warmup = Mathf.lerp(data.warmup, 0, 0.02);
                       }

                       for (var i in dumpItems) {
                           const item = dumpItems[i];
                           this.dump(item);
                       }
                       for (var i in dumpLiquids) {
                           const liquid = dumpLiquids[i];
                           this.dumpLiquid(liquid);
                       }
                   }
               },
               getPowerProduction() {
                   return plans.map(plan => plan.getPowerProducing(this)).reduce((v1, v2) => v1 + v2);
               },
               write(write) {
                   this.super$write(write);
                   write.f(data.warmup);
                   var len = 0;
                   for (var i in data.planDatas) {
                       len++
                   }
                   write.s(len);
                   for (var id in data.planDatas) {
                       const d = data.planDatas[id];
                       write.s(id);
                       write.f(d.progress);
                       write.bool(d.running);
                       write.f(d.powerProduceTime);
                       write.f(d.attrSum);
                       write.bool(d.itemsEaten);
                   }
               },
               read(read, revision) {
                   this.super$read(read, revision);
                   data.warmup = read.f();
                   const length = read.s();
                   for (var i = 0; i < length; i++) {
                       const d = {};
                       const id = read.s();
                       d.progress = read.f();
                       d.running = read.bool();
                       d.powerProduceTime = read.f();
                       d.attrSum = read.f();
                       d.itemsEaten = read.bool();
                       data.planDatas[id] = d;
                   }
               },
           });
           return entity;
       });
   }

   defineMultiCrafter({
       name: 'mc-test',
       itemCapacity: 100,
       liquidCapacity: 100,
       updateEffectChance: 0.05,
       updateEffect: Fx.none,
       ambientSound: Sounds.machine,
       ambientSoundVolume: 0.5,
       plans: [
           {
               consume: {
                   power: 0.5,
                   items: [
                       { item: Items.blastCompound, amount: 1 }
                   ],
                   liquids: [
                       { liquid: Liquids.cryofluid, amount: 6 }
                   ]
               },
               output: {
                   power: 50,
                   items: [
                       { item: Items.pyratite, amount: 1 },
                       { item: Items.sporePod, amount: 1 },
                   ],
                   liquids: [
                       { liquid: Liquids.oil, amount: 3 }
                   ]
               },
               craftEffect: Fx.flakExplosion,
               craftTime: 120,
               attribute: Attribute.oil,
               boostScale: 0.5
           },
           {
               consume: {
                   power: 0.5,
                   items: [
                       { item: Items.copper, amount: 1 }
                   ]
               },
               output: {
                   items: [
                       { item: Items.sand, amount: 1 }
                   ]
               },
               craftEffect: Fx.flakExplosion,
               craftTime: 1,
           },
           {
               consume: {
                   power: 0.5,
                   items: [
                       { item: Items.lead, amount: 1 }
                   ]
               },
               output: {
                   items: [
                       { item: Items.silicon, amount: 1 }
                   ]
               },
               craftEffect: Fx.flakExplosion,
               craftTime: 1,
           },
           {
               consume: {
                   power: 0.5,
                   items: [
                       { item: Items.coal, amount: 1 }
                   ]
               },
               output: {
                   items: [
                       { item: Items.titanium, amount: 1 }
                   ]
               },
               craftEffect: Fx.flakExplosion,
               craftTime: 1,
           },
           {
               consume: {
                   power: 0.5,
                   items: [
                       { item: Items.scrap, amount: 1 }
                   ]
               },
               output: {
                   items: [
                       { item: Items.thorium, amount: 1 }
                   ]
               },
               craftEffect: Fx.flakExplosion,
               craftTime: 1,
           },
           {
               consume: {
                   power: 0.5,
                   items: [
                       { item: Items.sporePod, amount: 1 }
                   ]
               },
               output: {
                   items: [
                       { item: Items.plastanium, amount: 1 }
                   ]
               },
               craftEffect: Fx.flakExplosion,
               craftTime: 1,
           },
           {
               consume: {
                   power: 0.5,
                   items: [
                       { item: Items.pyratite, amount: 1 }
                   ]
               },
               output: {
                   items: [
                       { item: Items.surgeAlloy, amount: 1 }
                   ]
               },
               craftEffect: Fx.flakExplosion,
               craftTime: 1,
           },
       ]
   });
