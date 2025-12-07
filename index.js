const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalNear } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot is arrived bed'));
app.listen(8000, () => console.log('server started'));

// -------- USERNAME ROTATION SYSTEM ----------
let usernameIndex = 0;

function getNextUsername() {
  const list = config['bot-account'].usernames;
  usernameIndex++;
  if (usernameIndex >= list.length) usernameIndex = 0;
  return list[usernameIndex];
}
// --------------------------------------------

function createBot() {

  const bot = mineflayer.createBot({
    username: config['bot-account'].usernames[usernameIndex],
    password: config['bot-account'].password,
    auth: config['bot-account'].type,
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

      let count = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < count; i++) {
        let a = actions[Math.floor(Math.random() * actions.length)];
        a();
      }

      let next = Math.floor(Math.random() * 4000) + 3000;
      setTimeout(randomMovementLoop, next);
    }

    randomMovementLoop();

    // AUTO SLEEP AT NIGHT
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
            bot.pathfinder.setGoal(
              new GoalNear(bed.position.x, bed.position.y, bed.position.z, 1)
            );

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

  // JUST CHAT LOG
  bot.on('chat', (u, msg) => console.log(`[ChatLog] <${u}> ${msg}`));

  bot.on('goal_reached', () => console.log(`[AfkBot] Goal reached`));
  bot.on('death', () => console.log("[AfkBot] Bot died & respawned"));

  // ---------- BAN / KICK DETECT ----------
  bot.on('kicked', (reason) => {
    console.log("KICKED =>", reason);

    const msg = reason.toString().toLowerCase();
    if (msg.includes("ban") || msg.includes("banned")) {
      console.log("Bot is BANNED! Changing username...");

      const newName = getNextUsername();
      console.log("New username =>", newName);

      // wait 15 seconds then restart
      setTimeout(createBot, 15000);
      return;
    }

    // normal kick -> reconnect
    setTimeout(createBot, 15000);
  });
  // ----------------------------------------

  bot.on('error', (err) => console.log("[ERROR]", err.message));

  bot.on('end', () => {
    console.log("Bot disconnected → Reconnecting in 15 sec...");
    setTimeout(createBot, 15000);
  });
}

createBot();createBot();
