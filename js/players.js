function Players () {
    this.players = {};
    this.names = {};

    this.friends = [];
    this.ignores = {};
}

Players.prototype.login = function(id, info) {
    this.myid = id;

    var obj = {};
    obj[id] = info;
    this.addPlayer(obj);

    $("#trainer_username").text(this.myname());
};

Players.prototype.hasPlayer = function(pid) {
    return pid in this.players;
};

Players.prototype.addPlayer = function (players) {
    for (var id in players) {
        var player = players[id];
        var name = player.name.toLowerCase();

        player.id = +(id);

        if (!(id in this.players)) {
            this.players[id] = player;
        } else {
            delete this.names[this.players[id].name.toLowerCase()]; // Delete old names.

            /* Update only the new params */
            for (var x in player) {
                this.players[id][x] = player[x];
            }
        }

        this.names[name] = this.players[id];

        if (currentChannel != -1 && channels.current().hasPlayer(id)) {
            playerList.updatePlayer(id);
        }
        pms.playerLogin(id);

        if (id == this.myid) {
            $("#trainer_username").text(this.myname());
        }
    }
};

Players.prototype.addFriend = function(id) {
    if (this.friends.indexOf(id) === -1) this.friends.push(id);
    if (id in this.players) this.players[id].friend = true;
};

Players.prototype.addIgnore = function(id) {
    this.ignores[id] = true;
    if (id in this.players) this.players[id].ignored = true;
};

Players.prototype.removeIgnore = function(id) {
    delete this.ignores[id];
    if (id in this.players) this.players[id].ignored = false;
};

Players.prototype.isIgnored = function(id) {
    return id in this.players && this.players[id].ignored;
};

Players.prototype.removePlayer = function (id) {
    var player = this.players[id];

    if (!player) {
        return;
    }

    if (this.friends.indexOf(id) !== -1) {
        this.friends.splice(this.friends.indexOf(id), 1);
        pms.playerLogout(id);
    }

    delete this.names[player.name.toLowerCase()];
    delete this.players[id];

    battles.removePlayer(id);
};

Players.prototype.player = function (pid) {
    if (pid in this.players) {
        return this.players[pid];
    } else if ((pid + "").toLowerCase() in this.names) {
        return this.names[(pid + "").toLowerCase()];
    }

    return null;
};

Players.prototype.name = function(pid) {
    return ((pid in this.players) ? this.players[pid].name : "???");
};

Players.prototype.auth = function(pid) {
    return ((pid in this.players) ? this.players[pid].auth : 0);
};

Players.prototype.myname = function() {
    return this.name(this.myid);
};

Players.prototype.id = function (name) {
    var player = this.names[name.toLowerCase()];

    return (name.toLowerCase() in this.names) ? this.names[name.toLowerCase()].id : -1;
};

Players.prototype.testPlayerOnline = function(player) {
    if (this.friends.indexOf(player) !== -1) {
        return;
    }

    for (var i in channels.channels) {
        if (player in channels.channel(i).players) {
            return;
        }
    }

    this.removePlayer(player);
};

Players.prototype.color = function (id) {
    var player = this.player(id);

    if (!player) {
        return "#000000";
    }

    var color = player.color;

    if (!color) {
        var namecolorlist = ['#5811b1', '#399bcd', '#0474bb', '#f8760d', '#a00c9e', '#0d762b', '#5f4c00', '#9a4f6d', '#d0990f', '#1b1390', '#028678', '#0324b1'];
        return namecolorlist[id % namecolorlist.length];
    }
    return color;
};

/* Fast index search in a sorted array */
Array.prototype.dichotomy = function(func) {
    if (this.length === 0) return 0;

    var min = 0;
    var max = this.length-1;

    while (1) {
        var half = Math.floor(min+(max-min)/2);

        var cmp = func(this[half]);
        if (min === max) {
            return half + (cmp > 0 ? 1 : 0);
        }

        if (cmp < 0) {
            max = half;
        } else if (cmp > 0) {
            min = (min === half ? max : half);
        } else {
            return half;
        }

    }
};

/* The list of players */
function PlayerList () {
    this.ids = [];
    this.filter = '';
}

PlayerList.prototype.setPlayers = function(playerIds) {
    var list = $("#player-list").html("");
    /* Could be optimized, but later */
    playerIds.sort(function(a, b) {
        return players.name(a).toLowerCase().localeCompare(players.name(b).toLowerCase());
    });
    playerIds.forEach(function(id) {
        list.append(this.createPlayerItem(id));
    }, this);
    this.ids = playerIds;
    this.updatePlayerCount();
};

PlayerList.prototype.updatePlayerCount = function () {
    $("#players_count").text(this.ids.length + (this.ids.length != 1 ? " Users" : " User"));
};

PlayerList.prototype.createPlayerItem = function(id) {
    var name = players.name(id);
    var ret = $("<li class='player-list-item player-auth-" + players.auth(id) + "' id='player-"+id+"'>").html(name);
    if (battles.isBattling(id)) {
        ret.addClass('player-battling');
    }
    /* If there's a filter and it's no match, hide the player name */
    if (this.filter && name.toLowerCase().indexOf(this.filter) === -1) {
        ret.hide();
    }
    return ret;
};

PlayerList.prototype.addPlayer = function(id) {
    var name = players.name(id);
    var lname = name.toLowerCase();

    /* Find the place where to put the name - dichotomy */
    var pos = this.ids.dichotomy(function(id) {
        return lname.localeCompare(players.name(id).toLowerCase());
    });

    /* Add the graphical element */
    var item = this.createPlayerItem(id);
    if (pos === this.ids.length) {
        $("#player-list").append(item);
    } else {
        /* Inserts the item before the player at pos */
        $(".player-list-item#player-"+this.ids[pos]).before(item);
    }

    this.ids.splice(pos, 0, id);

    this.updatePlayerCount();
};

PlayerList.prototype.removePlayer = function(id) {
    var pos = this.ids.indexOf(id);
    if (pos !== -1) {
        this.ids.splice(pos, 1);
    }
    /* Remove the graphical element */
    $(".player-list-item#player-"+id).remove();
    this.updatePlayerCount();
};

PlayerList.prototype.updatePlayer = function(id) {
    if (this.ids.indexOf(id) !== -1) {
        this.removePlayer(id);
        this.addPlayer(id);
    }
};
