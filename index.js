const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalNear, GoalBlock } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const express = require('express');

// -----------------------
// USERNAME ROTATION SYSTEM
// -----------------------
let usernameIndex = 0;

function getBotUsername() {
  return config['bot-account'].usernames[usernameIndex];
}

function rotateUsername() {
  usernameIndex++;
  if (usernameIndex >= config['bot-account'].usernames.length) {
    usernameIndex = 0;
  }
  return config['bot-account'].usernames[usernameIndex];
}

// -----------------------------------
const app = express();
app.get('/', (req, res) => res.send('Bot is arrived bed'));
app.listen(8000, () => console.log('server started'));

function createBot() {
  const bot = mineflayer.createBot({
    username: getBotUsername(),            // FIXED USERNAME HANDLER
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
    console.log(`[AfkBot] Bot joined as: ${bot.username}`);

    // AUTO AUTH
    if (config.utils['auto-auth'].enabled) {
      let pass = config.utils['auto-auth'].password;
      setTimeout(() => {
        bot.chat(`/register ${pass} ${pass}`);
        bot.chat(`/login ${pass}`);
      }, 500);
    }

    // RANDOM MOVEMENT
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
      stops.forEach(c => bot.setControlState(c, false));

      let howMany = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < howMany; i++) {
        let a = actions[Math.floor(Math.random() * actions.length)];
        a();
      }

      let next = Math.floor(Math.random() * 4000) + 3000;
      setTimeout(randomMovementLoop, next);
    }

    randomMovementLoop();

    // AUTO SLEEP
    async function trySleep() {
      try {
        if (!bot.time.isDay) {
          console.log("Night detected → Searching bed...");
          let bed = bot.findBlock({
            matching: block => bot.isABed(block),
            maxDistance: 20
          });

          if (bed) {
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
          }
        }
      } catch (e) {}
    }
    setInterval(trySleep, 5000);
  });

  // CHAT LOG
  bot.on('chat', (u, msg) => console.log(`[ChatLog] <${u}> ${msg}`));

  bot.on('goal_reached', () => console.log(`[AfkBot] Goal reached`));
  bot.on('death', () => console.log("[AfkBot] Bot died & respawned"));

  // --------------------------------------
  //   BAN DETECT → USERNAME SWITCH
  // --------------------------------------
  bot.on('kicked', reason => {
    console.log("[KICKED] ", reason);

    const lower = reason.toString().toLowerCase();

    if (lower.includes("ban")) {
      console.log("BAN detected → switching username...");
      const newName = rotateUsername();
      console.log("NEW username:", newName);

      setTimeout(createBot, 15000);
      return;
    }

    setTimeout(createBot, config.utils['auto-recconect-delay']);
  });

  bot.on('error', e => console.log("[ERROR]", e.message));

  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      console.log("Reconnecting...");
      setTimeout(createBot, config.utils['auto-recconect-delay']);
    });
  }
}

createBot();
