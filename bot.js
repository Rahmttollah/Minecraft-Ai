// ============================================================
//        FINAL LIGHT MODE AI BOT + ATERNOS SAFE RESTART
// ============================================================






const http = require("http");
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running!\n");
}).listen(PORT, () => {
  console.log("HTTP server running on port " + PORT);
});




// =====================================================
//   ULTRA REAL PLAYER BOT (NO AFK, ALWAYS ACTIVE)
//   Move | Sprint | Jump | Crouch | Parkour | Sleep
//   ZERO CHAT, ZERO IDLE, RENDER-SAFE
// =====================================================

function startBot() {

  const mineflayer = require("mineflayer")
  const vec3 = require("vec3")

  let bot = mineflayer.createBot({
    host: "rahmttollahai.aternos.me",
    port: 48219,
    username: "StevBot"
  })

  const sleep = ms => new Promise(r => setTimeout(r, ms))


  // ---------------------------
  // REAL PLAYER MOVEMENT ENGINE
  // ---------------------------
  async function realMovement() {

    bot.setControlState("forward", true)
    let sprinting = false
    let sneaking = false

    while (true) {

      // Smooth real-player turning
      const yaw = bot.entity.yaw + (Math.random() * 0.8 - 0.4)
      try { bot.look(yaw, 0, true) } catch {}

      // Random high jump / bunny hop
      if (Math.random() < 0.55) {
        bot.setControlState("jump", true)
        await sleep(150)
        bot.setControlState("jump", false)
      }

      // Random sprint like real players pressing CTRL
      if (!sprinting && Math.random() < 0.35) {
        bot.setControlState("sprint", true)
        sprinting = true
      } 
      else if (sprinting && Math.random() < 0.18) {
        bot.setControlState("sprint", false)
        sprinting = false
      }

      // Crouch-tap (real player style)
      if (!sneaking && Math.random() < 0.15) {
        bot.setControlState("sneak", true)
        sneaking = true
        await sleep(400 + Math.random() * 300)
        bot.setControlState("sneak", false)
        sneaking = false
      }

      // Step boosting / obstacle hop
      if (Math.random() < 0.2) {
        bot.setControlState("jump", true)
        await sleep(200)
        bot.setControlState("jump", false)
      }

      // No idle → ALWAYS moving
      bot.setControlState("forward", true)

      await sleep(180)  // smooth + CPU-safe loop
    }
  }


  // ---------------------------
  // AUTO SLEEP (nearest bed)
  // ---------------------------
  async function autoSleep() {
    while (true) {
      await sleep(2000)

      if (!bot.time) continue
      if (bot.time.timeOfDay <= 13000) continue  // day
      if (bot.isSleeping) continue

      const bed = bot.findBlock({
        maxDistance: 80,
        matching: b => b.name && b.name.includes("bed")
      })

      if (!bed) continue

      const pos = bed.position

      // walk towards bed manually
      while (bot.entity.position.distanceTo(pos) > 2) {
        const dx = pos.x - bot.entity.position.x
        const dz = pos.z - bot.entity.position.z
        const yaw = Math.atan2(-dx, -dz)

        try { bot.look(yaw, 0, true) } catch {}

        bot.setControlState("forward", true)

        await sleep(200)
      }

      bot.setControlState("forward", false)

      try { await bot.sleep(bot.blockAt(pos)) } catch {}
    }
  }


  // ---------------------------
  // NO CHAT (SILENT MODE)
  // ---------------------------
  bot.on("chat", () => {})     // ignore chat
  bot.on("message", () => {})  // ignore server messages
  bot.on("whisper", () => {})  // ignore whispers


  // ---------------------------
  // ON SPAWN
  // ---------------------------
  bot.on("spawn", () => {
    realMovement()
    autoSleep()
  })


  // ---------------------------
  // AUTO RESTART (Render safe)
  // ---------------------------
  let restarting = false
  function restartBot() {
    if (restarting) return
    restarting = true

    try { bot.quit() } catch {}
    bot = null

    setTimeout(() => {
      restarting = false
      startBot()
    }, 15000)
  }

  bot.on("error", restartBot)
  bot.on("end", restartBot)
  bot.on("kicked", restartBot)
}

startBot()
