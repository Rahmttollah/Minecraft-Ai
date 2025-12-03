const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalNear, GoalBlock } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot is arrived bed'));
app.listen(8000, () => console.log('server started'));

function createBot() {
  const bot = mineflayer.createBot({
    username: config['bot-account']['username'],
    password: config['bot-account']['password'],
    auth: config['bot-account']['type'],
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version,
  });

  bot.loadPlugin(pathfinder);

  const mcData = require('minecraft-data')(config.server.version);
  const defaultMove = new Movements(bot, mcData);

  bot.settings.colorsEnabled = false;

  bot.once('spawn', () => {
    console.log('[AfkBot] Bot joined to server');

    // -----------------------------
    // AUTO AUTH / LOGIN
    // -----------------------------
    if (config.utils['auto-auth'].enabled) {
      let pass = config.utils['auto-auth'].password;
      setTimeout(() => {
        bot.chat(`/register ${pass} ${pass}`);
        bot.chat(`/login ${pass}`);
      }, 500);
    }

    // --------------------------------
    // REAL PLAYER RANDOM MOVEMENT LOOP
    // --------------------------------
    function randomMovementLoop() {
      const actions = [
        () => bot.setControlState('forward', true),
        () => bot.setControlState('back', true),
        () => bot.setControlState('left', true),
        () => bot.setControlState('right', true),
        () => bot.setControlState('sneak', true),
        () => bot.setControlState('jump', true),
        () => bot.setControlState('sprint', true)
      ];

      const stops = ['forward','back','left','right','sneak','jump','sprint'];

      // STOP ALL CONTROLS FIRST
      stops.forEach(c => bot.setControlState(c, false));

      // ACTIVATE RANDOM ACTIONS (1–3 actions at once)
      let howMany = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < howMany; i++) {
        let a = actions[Math.floor(Math.random() * actions.length)];
        a();
      }

      // Change every 3–7 seconds
      let next = Math.floor(Math.random() * 4000) + 3000;
      setTimeout(randomMovementLoop, next);
    }

    // Start movement loop
    randomMovementLoop();


    // -----------------------------------
    // NIGHT SLEEP SYSTEM (AUTO BED FIND)
    // -----------------------------------
    async function trySleep() {
      try {
        if (!bot.time.isDay) {
          console.log("Night detected → Searching bed...");
          let bed = bot.findBlock({
            matching: block => bot.isABed(block),
            maxDistance: 20
          });

          if (bed) {
            console.log("Bed found → Going...");
            bot.pathfinder.setMovements(defaultMove);
            bot.pathfinder.setGoal(new GoalNear(bed.position.x, bed.position.y, bed.position.z, 1));

            setTimeout(async () => {
              try {
                await bot.sleep(bed);
                console.log("Bot is sleeping...");
              } catch (err) {
                console.log("Sleep error:", err.message);
              }
            }, 3000);
          } else {
            console.log("No bed found near.");
          }
        }
      } catch (e) {}
    }

    setInterval(trySleep, 5000);

  });

  // CHAT LOG ONLY, NO BOT MESSAGES
  bot.on('chat', (u, msg) => {
    console.log(`[ChatLog] <${u}> ${msg}`);
  });

  bot.on('goal_reached', () => {
    console.log(`[AfkBot] Goal reached`);
  });

  bot.on('death', () => {
    console.log("[AfkBot] Bot died & respawned");
  });

  // RECONNECT FEATURE
  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      console.log("Reconnecting...");
      setTimeout(createBot, config.utils['auto-recconect-delay']);
    });
  }

  bot.on('kicked', r => console.log("[KICKED] ", r));
  bot.on('error', e => console.log("[ERROR]", e.message));
}

createBot();