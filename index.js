const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalNear } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const express = require('express');
const { v4: uuidv4 } = require('uuid');

// Web server (Render/Host)
const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(8000, () => console.log("Web server running..."));

// ------------------------------
// GLOBAL IDENTITY (changes only on ban)
// ------------------------------
let currentName = randomName();
let currentUUID = uuidv4();

// Prevent multiple bots
let bot = null;
let botRunning = false;


// RANDOM NAME GENERATOR
function randomName() {
  return "Player_" + Math.floor(Math.random() * 999999);
}


// MAIN BOT FUNCTION
function createBot() {

  if (botRunning) return;
  botRunning = true;

  console.log(`\n[START] Using identity → ${currentName} | ${currentUUID}`);

  bot = mineflayer.createBot({
    username: currentName,
    uuid: currentUUID,
    auth: "offline",
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version
  });

  bot.loadPlugin(pathfinder);

  const mcData = require('minecraft-data')(config.server.version);
  const defaultMove = new Movements(bot, mcData);

  bot.settings.colorsEnabled = false;


  // ON SPAWN
  bot.once('spawn', () => {
    console.log("[AFK BOT] Joined server.");

    // AUTO AUTH (if enabled)
    if (config.utils["auto-auth"].enabled) {
      const pass = config.utils["auto-auth"].password;
      setTimeout(() => {
        bot.chat(`/register ${pass} ${pass}`);
        bot.chat(`/login ${pass}`);
      }, 500);
    }

    // ---------------------------
    // SAFE RANDOM MOVEMENT LOOP
    // ---------------------------
    function randomMovementLoop() {
      // bot not ready = wait
      if (!bot || !bot.entity) {
        return setTimeout(randomMovementLoop, 2000);
      }

      const acts = ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak'];

      // stop before starting new movement
      acts.forEach(a => bot.setControlState(a, false));

      let count = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < count; i++) {
        let action = acts[Math.floor(Math.random() * acts.length)];
        bot.setControlState(action, true);
      }

      setTimeout(randomMovementLoop, Math.floor(Math.random() * 4000) + 3000);
    }

    // start movement safely  
    randomMovementLoop();


    // ---------------------------
    // AUTO SLEEP SYSTEM
    // ---------------------------
    async function trySleep() {
      if (!bot || !bot.entity) return;
      if (bot.time.isDay) return;

      let bed = bot.findBlock({
        matching: b => bot.isABed(b),
        maxDistance: 20
      });

      if (!bed) return;

      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalNear(bed.position.x, bed.position.y, bed.position.z, 1));

      setTimeout(async () => {
        try {
          await bot.sleep(bed);
          console.log("[BOT] Sleeping...");
        } catch (e) {}
      }, 2500);
    }

    setInterval(trySleep, 5000);
  });


  // CHAT LOG
  bot.on("chat", (u, msg) => {
    if (config.utils["chat-log"]) {
      console.log(`[CHAT] <${u}> ${msg}`);
    }
  });


  // BAN / KICK HANDLER
  bot.on("kicked", (reason) => {
    console.log("\n[KICKED] " + reason);

    reason = reason.toLowerCase();

    if (reason.includes("ban")) {
      console.log("[BAN DETECTED] Generating NEW identity...");
      currentName = randomName();
      currentUUID = uuidv4();
    } else {
      console.log("[INFO] Kick only → Keeping SAME identity");
    }

    botRunning = false;
    setTimeout(createBot, config.utils["auto-recconect-delay"]);
  });


  // NORMAL DISCONNECT
  bot.on("end", () => {
    console.log("[END] Disconnected → Reconnecting with SAME identity...");
    botRunning = false;
    setTimeout(createBot, config.utils["auto-recconect-delay"]);
  });


  bot.on("error", err => {
    console.log("[ERROR]", err.message);
    botRunning = false;
  });
}


// START BOT
createBot();
