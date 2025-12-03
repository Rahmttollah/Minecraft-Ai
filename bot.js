

// =====================================================
//         ULTRA LIGHT BOT (Follow + Go + Autoplay)
//       Aternos Safe Auto-Restart (No Crash)
// =====================================================

// =====================================================
//      CRASH-PROOF ALWAYS MOVING BOT (WISPBYTE SAFE)
// =====================================================

// --- HTTP Keep-Alive Server for Render ---
const http = require("http");
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running!\n");
}).listen(PORT, () => {
  console.log("HTTP server running on port " + PORT);
});



function startBot() {

  const mineflayer = require("mineflayer")

  let bot = mineflayer.createBot({
    host: "rahmttollahai.aternos.me",
    port: 48219,
    username: "AlexBot"
  })

  const sleep = ms => new Promise(r => setTimeout(r, ms))


  bot.on("spawn", () => {
    console.log("BOT ONLINE ✔")
    smoothMovement()
  })


  // ------------------------------------------
  //   ULTRA-SMOOTH LOW-CPU MOVEMENT LOOP
  // ------------------------------------------
  async function smoothMovement() {

    let moving = true

    // enable forward movement
    bot.setControlState("forward", true)

    while (moving) {

      // random small yaw change (every 2 sec)
      const yaw = Math.random() * Math.PI * 2
      bot.look(yaw, 0, true)

      // jump occasionally
      if (Math.random() < 0.4) {
        bot.setControlState("jump", true)
        await sleep(200)
        bot.setControlState("jump", false)
      }

      // VERY IMPORTANT:
      // wait 200ms → prevents CPU spikes
      await sleep(200)
    }
  }


  // =====================================================
  //               AUTO-RESTART (12 sec delay)
  // =====================================================
  
  let reconnecting = false

  function restartBot() {
    if (reconnecting) return
    reconnecting = true

    console.log("\n[!] Disconnected — retry in 12s...\n")

    try { bot.quit() } catch {}
    bot = null

    setTimeout(() => {
      reconnecting = false
      console.log("[+] Reconnecting...")
      startBot()
    }, 20000)
  }

  bot.on("error", restartBot)
  bot.on("end", restartBot)
  bot.on("kicked", restartBot)
}

startBot()
