function Battles() {
    this.battles = {};
    this.battleList = {};
    this.battlesByPlayer = {};
}

Battles.prototype.isBattling = function(pid) {
    return (pid in this.battlesByPlayer);
};

Battles.prototype.addBattle = function (battles) {
    for (var id in battles) {
        var battle = battles[id];
        battle.id = id;
        this.battleList[id] = battle;
        if (!(battle.ids[0] in this.battlesByPlayer)) {
            this.battlesByPlayer[battle.ids[0]] = {};
        }
        this.battlesByPlayer[battle.ids[0]][id] = battle;
        if (!(battle.ids[1] in this.battlesByPlayer)) {
            this.battlesByPlayer[battle.ids[1]] = {};
        }
        this.battlesByPlayer[battle.ids[1]][id] = battle;

        playerList.updatePlayer(battle.ids[0]);
        playerList.updatePlayer(battle.ids[1]);

        /* Is it a battle we're taking part in ? */
        if (battle.team) {
            new BattleTab(battle.id, battle.conf, battle.team);
        }
    }
};

Battles.prototype.battleEnded = function(battleid, result) {
    //console.log("battle ended");
    var ids = this.battleList[battleid].ids;
    this.removeBattle(battleid);

    /* We do nothing with result yet... no printing channel events?! */
    playerList.updatePlayer(ids[0]);
    playerList.updatePlayer(ids[1]);
};

/* Maybe instead of a direct call from players it should be bound by some kind of event listener and
    called that way. */
Battles.prototype.removePlayer = function(pid) {
    /* If both players are not in memory for a battle, removes the battle from memory */
    for (var battleid in this.battlesByPlayer[pid]) {
        var battle = this.battlesByPlayer[pid][battleid];
        var ids = battle.ids;
        if (! players.hasPlayer(ids[0] == pid ? ids[1] : ids[0])) {
            this.removeBattle(battleid);
        }
    }
};

Battles.prototype.removeBattle = function(battleid) {
    var ids = this.battleList[battleid].ids;
    delete this.battlesByPlayer[ids[0]][battleid];
    delete this.battlesByPlayer[ids[1]][battleid];
    delete this.battleList[battleid];
    /* If a player has no more battles, useless to keep them in memory */
    if (!Object.keys(this.battlesByPlayer[ids[0]]).length) {
        delete this.battlesByPlayer[ids[0]];
    }
    if (!Object.keys(this.battlesByPlayer[ids[1]]).length) {
        delete this.battlesByPlayer[ids[1]];
    }
};

Battles.prototype.battle = function(pid) {
    if (pid in this.battles) {
        return this.battles[pid];
    }

    console.log("no battle with id " + pid + " found, current ids: " + JSON.stringify(Object.keys(this.battles)));
};

Battles.prototype.watchBattle = function(bid, conf) {
    if (bid in this.battles) {
        console.log("Already watching battle " + bid + " with conf " + JSON.stringify(conf));
        return;
    }
    new BattleTab(bid, conf);
};

function BattleTab(pid, conf, team) {
    /* me and meIdent are needed by PS stuff */
    this.me = {
        name: players.myname()
    };

    this.meIdent = {
        name: this.me.name,
        named: 'init'
    };

    this.shortHand = "battle";
    this.id = pid;
    this.conf = conf;
    this.pokes = {};
    this.choices = {};
    this.spectators = {};
    /* PO separates damage message ("hurt by burn") and damage done. So we remember each damage message so we can give it
        together with the damage done to the Showdown window.
     */
    this.damageCause={};

    var name = players.name(conf.players[0]) + " vs " + players.name(conf.players[1]);

    if ($("#battle-" + pid).length === 0) {
        /* Create new tab */
        $('#channel-tabs').tabs("add", "#battle-" + pid, name+'<i class="icon-remove-circle"></i>');
        /* Cleaner solution to create the tab would be appreciated */
        var $content = $("#battle-" + pid);
        $content.html($("#battle-html").html());

        battles.battles[pid] = this;
        switchToTab("#battle-"+pid);

        if (team) {
            this.myself = conf.players[1] == players.myid ? 1 : 0;
        }
    }
}

BattleTab.inherits(ChannelTab);

BattleTab.onChatKeyDown = function(event, obj) {
    if(event.keyCode==13) {
        sendMessage(obj);
    }
};

/** Calls the onXxxxXxxx functions where xxxxXxxx is the name attribute of the button
 * in the controls that was clicked
 * @param event the click event
 * @param battle the object to use as this
 */
BattleTab.prototype.dealWithControlsClick = function(event) {
    var $obj = $(event.target);
    var battle = event.data;
    while ($obj.length > 0 && $obj != $(this)) {
        var name = $obj.attr("name");
        if (name !== undefined) {
            var funcName = "onControls"+name[0].toUpperCase()+name.slice(1);
            if (funcName in BattleTab.prototype) {
                battle[funcName]($obj);
                return true;
            }
        }
        var oldobj = $obj;
        $obj = $obj.parent();

        if (oldobj == $obj) {
            break;
        }
    }
    return false;
};

/**
 * Called when a chooseMove button is clicked
 * @param $obj The button jquery object
 */
BattleTab.prototype.onControlsChooseMove = function($obj) {
    console.log ("move " + $obj.attr("slot") + " ( " + $obj.attr("value") + ") called");
    var choice = {"type":"attack", "slot":this.myself, "attackSlot": + $obj.attr("slot")};
    this.choose(choice);
};

/**
 * Called when a chooseMove button is clicked
 * @param $obj The button jquery object
 */
BattleTab.prototype.onControlsChooseSwitch = function($obj) {
    console.log ("poke " + $obj.attr("slot") + " ( " + $obj.attr("value") + ") called");
    var choice = {"type":"switch", "slot":this.myself, "pokeSlot": + $obj.attr("slot")};
    this.choose(choice);
};

BattleTab.prototype.onControlsChooseTeamPreview = function($obj) {
    var choice = {"type":"rearrange", "slot":this.myself, "neworder": neworder};
    this.choose(choice);
};

/* Loads the choices in PS format in this.request.active[x], x being the pokemon slot */
BattleTab.prototype.loadChoices = function() {
    this.request.active[0].moves = this.request.side.pokemon[0].moveDetails;
    console.log("loaded choices");
};

BattleTab.prototype.playerIds = function() {
    var array = [];
    for (var i = 0; i < this.conf.players.length; i++) {
        array.push(this.conf.players[i]);
    }
    for (var x in this.spectators) {
        array.push(x);
    }

    return array;
};

BattleTab.prototype.chat = function () {
    return $("#battle-" + this.id + " #chatTextArea");
};

BattleTab.prototype.print = function(msg) {
    var chatTextArea = this.chat().get(0);

    chatTextArea.innerHTML += msg + "<br/>\n";

    /* Limit number of lines */
    if (this.chatCount++ % 500 === 0) {
        chatTextArea.innerHTML = chatTextArea.innerHTML.split("\n").slice(-500).join("\n");
    }
    chatTextArea.scrollTop = chatTextArea.scrollHeight;
};

BattleTab.prototype.choose = function(choice)
{
    websocket.send("battlechoice|"+this.id+"|"+JSON.stringify(choice));
};

BattleTab.prototype.isBattle = function() {
    return this.conf.players[0] == players.myid || this.conf.players[1] == players.myid;
};

BattleTab.prototype.close = function() {
    delete battles.battles[this.id];
    $('#channel-tabs').tabs("remove", "#battle-" + this.id);
    if (this.isBattle()) {
        websocket.send("forfeit|"+this.id);
    } else {
        websocket.send("stopwatching|"+this.id);
    }
};

/* Receives a PO command, and translates it in PS language.

    PS language: |a|b|c|[xx=y]|[zz=ff] -> battle.runMinor/Major([a,b,c],{xx=y,zz=ff})
 */
BattleTab.prototype.dealWithCommand = function(params) {
    var funcName = "dealWith"+params.command[0].toUpperCase() + params.command.slice(1);
    if (funcName in BattleTab.prototype) {
        this[funcName](params);
    }
};

BattleTab.prototype.addCommand = function(args, kwargs, preempt) {
    kwargs = kwargs||{};
    for (var x in kwargs) {
        args.push("["+x+"]"+kwargs[x]);
    }
    if (!preempt) {
        this.battle.add("|"+args.join("|"));
    } else {
        this.battle.instantAdd("|"+args.join("|"));
    }
};


BattleTab.statuses = {
    0: "",
    1: "par",
    2: "slp",
    3: "frz",
    4: "brn",
    5: "psn",
    6: "confusion",
    31: "fnt"
};

BattleTab.weathers = {
    0: "none",
    1: "hail",
    2: "raindance",
    3: "sandstorm",
    4: "sunnyday"
};

BattleTab.clauses = {
    0: "Sleep Clause",
    1: "Freeze Clause",
    2: "Disallow Spects",
    3: "Item Clause",
    4: "Challenge Cup",
    5: "No Timeout",
    6: "Species Clause",
    7: "Wifi Battle",
    8: "Self-KO Clause"
};

//
//BattleTab.prototype.updateSide = function(sideData, midBattle) {
//    for (var i = 0; i < sideData.pokemon.length; i++) {
//        var pokemonData = sideData.pokemon[i];
//        var pokemon;
//        if (i == 0) {
//            pokemon = this.battle.getPokemon(''+pokemonData.ident, pokemonData.details);
//            pokemon.slot = 0;
//            pokemon.side.pokemon = [pokemon];
//            // if (pokemon.side.active[0] && pokemon.side.active[0].ident == pokemon.ident) pokemon.side.active[0] = pokemon;
//        } else if (i < this.battle.mySide.active.length) {
//            pokemon = this.battle.getPokemon('new: '+pokemonData.ident, pokemonData.details);
//            pokemon.slot = i;
//            // if (pokemon.side.active[i] && pokemon.side.active[i].ident == pokemon.ident) pokemon.side.active[i] = pokemon;
//            if (pokemon.side.active[i] && pokemon.side.active[i].ident == pokemon.ident) {
//                pokemon.side.active[i].item = pokemon.item;
//                pokemon.side.active[i].ability = pokemon.ability;
//                pokemon.side.active[i].baseAbility = pokemon.baseAbility;
//            }
//        } else {
//            pokemon = this.battle.getPokemon('new: '+pokemonData.ident, pokemonData.details);
//        }
//        pokemon.healthParse(pokemonData.condition);
//        if (pokemonData.baseAbility) {
//            pokemon.baseAbility = pokemonData.baseAbility;
//            if (!pokemon.ability) pokemon.ability = pokemon.baseAbility;
//        }
//        pokemon.item = pokemonData.item;
//        pokemon.moves = pokemonData.moves;
//    }
//    this.battle.mySide.updateSidebar();
//};