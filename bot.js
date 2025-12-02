// =============================================================
//          FULL AI BOT + AUTO-RESTART (NO TERMINAL REQUIRED)
// =============================================================
const http = require("http");
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running!\n");
}).listen(PORT, () => {
  console.log("HTTP server running on port " + PORT);
});



// =====================================================
//         ULTRA LIGHT BOT (Follow + Go + Autoplay)
//       Aternos Safe Auto-Restart (No Crash)
// =====================================================

function startBot() {

  const mineflayer = require("mineflayer")
  const { pathfinder, Movements, goals } = require("mineflayer-pathfinder")

  let bot = mineflayer.createBot({
    host: "rahmttollahai.aternos.me",
    port: 48219,
    username: "AlexBot"
  })

  bot.loadPlugin(pathfinder)

  let mcData
  let lastChatTime = 0

  // ------------ Helpers -------------
  const clean = msg => msg.replace(/§./g, "").replace(/<.*?>/g, "").trim().toLowerCase()
  const sleep = ms => new Promise(r => setTimeout(r, ms))

  function rateChat(msg) {
    const now = Date.now()
    if (now - lastChatTime < 4000) return
    lastChatTime = now
    try { bot.chat(msg) } catch {}
  }

  // ------------ Movement Setup -------------
  function setupMoves() {
    mcData = require("minecraft-data")(bot.version)
    bot.movements = new (require("mineflayer-pathfinder").Movements)(bot, mcData)
    bot.movements.allowSprinting = true
    bot.pathfinder.setMovements(bot.movements)
  }

  // ------------ Basic Go Command -------------
  async function goTo(x, y, z) {
    setupMoves()
    try { bot.pathfinder.setGoal(null) } catch {}
    bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z))
    rateChat(`Ja raha hoon ${x} ${y} ${z}`)
  }

  // ------------ Follow Player -------------
  function geyserPlayer(name) {
    const low = name.toLowerCase()
    const list = Object.values(bot.players)
    return (
      list.find(p => p.username?.toLowerCase() === "." + low) ||
      list.find(p => p.username?.toLowerCase().includes("." + low)) ||
      list.find(p => p.username?.toLowerCase().includes(low)) ||
      null
    )
  }

  async function follow(username) {
    const p = geyserPlayer(username)
    if (!p || !p.entity) return rateChat("Player not found")
    rateChat("Following " + p.username)
    bot.pathfinder.setGoal(new goals.GoalFollow(p.entity, 2), true)
  }

  // ------------ Simple Autoplay -------------
  async function autoPlay() {
    while (true) {
      await sleep(3000)

      // minimal random walk
      const pos = bot.entity.position
      const dx = (Math.random() * 10 - 5)
      const dz = (Math.random() * 10 - 5)

      setupMoves()
      bot.pathfinder.setGoal(new goals.GoalBlock(pos.x + dx, pos.y, pos.z + dz))
    }
  }

  // ------------ Chat Commands -------------
  bot.on("chat", async (username, message) => {
    if (username === bot.username) return

    const msg = clean(message)
    const parts = msg.split(" ")

    // FOLLOW ME
    if (msg === "follow me" || msg === "follow") {
      follow(username)
      return
    }

    // GO x y z
    if (parts[0] === "go" || parts[0] === "goto") {
      const x = parseFloat(parts[1])
      const y = parseFloat(parts[2])
      const z = parseFloat(parts[3])
      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) goTo(x, y, z)
      else rateChat("Format: go x y z")
      return
    }

    rateChat("Samjha: " + msg)
  })

  // ------------ On Spawn -------------
  bot.on("spawn", () => {
    rateChat("Light Bot Online ✔")
    setupMoves()
    autoPlay() // start minimal autoplay
  })

  // ========================================================
  //            ANTI-CRASH / CLEAN AUTO RESTART
  // ========================================================

  let reconnecting = false

  function restartBot() {
    if (reconnecting) return
    reconnecting = true

    console.log("\n[!] Bot disconnected — retry in 15s...\n")

    try { bot.quit() } catch {}
    bot = null

    setTimeout(() => {
      reconnecting = false
      console.log("[+] Reconnecting now...")
      startBot()
    }, 15000)
  }

  bot.on("end", restartBot)
  bot.on("kicked", restartBot)
  bot.on("error", restartBot)
}

// FIRST START
startBot()
