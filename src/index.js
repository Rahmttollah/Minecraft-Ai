const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const config = require('../settings.json');

// Web server for keep-alive
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(8000, () => console.log("[WEB] Keep-alive server active on port 8000"));

let bot = null;
let botRunning = false;
let currentName = "Player_" + Math.floor(Math.random() * 999999);
let currentUUID = uuidv4();

function createBot() {
    if (botRunning) return;
    botRunning = true;

    console.log(`\n[START] Connecting as ${currentName} to ${config.server.ip}:${config.server.port}`);

    bot = mineflayer.createBot({
        host: config.server.ip,
        port: config.server.port,
        username: currentName,
        uuid: currentUUID,
        version: "1.20.1",
        auth: "offline",
        checkTimeoutInterval: 60000
    });

    let defaultMove = null;

    bot.on('inject_allowed', () => {
        const mcData = require('minecraft-data')(bot.version || "1.20.1");
        if (mcData) {
            bot.loadPlugin(pathfinder);
            defaultMove = new Movements(bot, mcData);
            // Optimization for pathfinding
            defaultMove.canDig = false;
            defaultMove.allow1by1towers = false;
            bot.pathfinder.setMovements(defaultMove);
            console.log("[INIT] Plugins and movement data loaded.");
        }
    });

    bot.once('spawn', () => {
        console.log("[GAME] Bot spawned in world.");
        bot.settings.colorsEnabled = false;

        // Auto-auth logic
        if (config.utils["auto-auth"]?.enabled) {
            const pass = config.utils["auto-auth"].password;
            setTimeout(() => {
                bot.chat(`/register ${pass} ${pass}`);
                setTimeout(() => bot.chat(`/login ${pass}`), 1000);
            }, 2000);
        }

        // Join command logic
        if (config.utils["join-command"]?.enabled) {
            const cmd = config.utils["join-command"].command;
            setTimeout(() => {
                console.log(`[GAME] Executing join command: ${cmd}`);
                bot.chat(cmd);
            }, 4000);
        }

        // Random movement to prevent AFK kick
        const movementLoop = () => {
            if (!bot?.entity) return setTimeout(movementLoop, 5000);
            
            const states = ['forward', 'back', 'left', 'right', 'jump', 'sprint'];
            const randomState = states[Math.floor(Math.random() * states.length)];
            
            bot.setControlState(randomState, true);
            setTimeout(() => {
                if (bot) bot.setControlState(randomState, false);
                setTimeout(movementLoop, Math.floor(Math.random() * 5000) + 5000);
            }, 1000);
        };
        movementLoop();

        // Auto-sleep logic
        const sleepInterval = setInterval(async () => {
            if (!bot?.entity || bot.time.isDay || !defaultMove) return;

            const bed = bot.findBlock({
                matching: b => bot.isABed(b),
                maxDistance: 16
            });

            if (bed) {
                console.log("[GAME] Bed found, attempting to sleep...");
                try {
                    bot.pathfinder.setGoal(new goals.GoalNear(bed.position.x, bed.position.y, bed.position.z, 1));
                    setTimeout(async () => {
                        try { await bot.sleep(bed); } catch (e) {}
                    }, 3000);
                } catch (err) {}
            }
        }, 15000);

        bot.once('end', () => clearInterval(sleepInterval));
    });

    bot.on('chat', (username, message) => {
        if (config.utils["chat-log"]) {
            console.log(`[CHAT] <${username}> ${message}`);
        }
    });

    bot.on('kicked', (reason) => {
        const kickMsg = typeof reason === 'string' ? reason : JSON.stringify(reason);
        console.log(`[KICK] Reason: ${kickMsg}`);
        
        if (kickMsg.toLowerCase().includes("ban")) {
            console.log("[AUTH] Ban detected. Generating new identity...");
            currentName = "Player_" + Math.floor(Math.random() * 999999);
            currentUUID = uuidv4();
        }
    });

    bot.on('error', (err) => {
        console.error(`[ERR] ${err.message}`);
    });

    bot.on('end', () => {
        console.log("[EXIT] Connection closed. Restarting in " + (config.utils["auto-recconect-delay"] / 1000) + "s...");
        botRunning = false;
        bot = null;
        setTimeout(createBot, config.utils["auto-recconect-delay"] || 10000);
    });
}

createBot();

