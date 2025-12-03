// ============================================================
//        FINAL LIGHT MODE AI BOT + ATERNOS SAFE RESTART
// ============================================================

function startBot() {




















  const mineflayer = require("mineflayer")
  const vec3 = require("vec3")

  let bot = mineflayer.createBot({
    host: "rahmttollahai.aternos.me",
    port: 48219,
    username: "AlexBot"
  })

  const sleep = ms => new Promise(r => setTimeout(r, ms))

  // Movement tuning
  const MOVE_INTERVAL = 220
  const JUMP_CHANCE = 0.45
  const SPRINT_CHANCE = 0.25
  const SNEAK_CHANCE = 0.12

  function forwardVector(yaw) {
    const dx = -Math.sin(yaw)
    const dz = Math.cos(yaw)
    return { dx, dz }
  }

  function blockAtOffset(x, y, z) {
    const pos = bot.entity.position
    return bot.blockAt(vec3(
      Math.floor(pos.x + x),
      Math.floor(pos.y + y),
      Math.floor(pos.z + z)
    ))
  }

  function isSpaceAhead(dist = 1, height = 1) {
    const yaw = bot.entity.yaw
    const { dx, dz } = forwardVector(yaw)
    for (let h = 0; h < height; h++) {
      const b = blockAtOffset(dx * dist, h, dz * dist)
      if (b && b.boundingBox !== "empty") return false
    }
    return true
  }

  function groundAhead(dist = 1) {
    const yaw = bot.entity.yaw
    const { dx, dz } = forwardVector(yaw)
    return blockAtOffset(dx * dist, -1, dz * dist)
  }

  function gapLengthAhead(max = 6) {
    const yaw = bot.entity.yaw
    const { dx, dz } = forwardVector(yaw)
    for (let g = 0; g <= max; g++) {
      const b = blockAtOffset(dx * (g + 1), -1, dz * (g + 1))
      if (b && b.boundingBox !== "empty") return g
    }
    return max + 1
  }

  // ================ AUTO EAT ================
  async function eatIfHungry() {
    if (bot.food !== undefined && bot.food > 16) return
    const food = bot.inventory.items().find(i =>
      ["bread","apple","cooked","steak","pork","chicken","carrot","potato"].some(f => i.name.includes(f))
    )
    if (food) {
      try {
        await bot.equip(food, "hand")
        await bot.consume()
      } catch {}
    }
  }

  // ================ IDLE HEAD MOVEMENT ================
  async function idleHeadLoop() {
    while (true) {
      await sleep(8000 + Math.random() * 8000)
      if (!bot.entity) continue

      const r = Math.random()
      try {
        if (r < 0.4) bot.look(bot.entity.yaw, -0.6, true)
        else if (r < 0.8) bot.look(bot.entity.yaw + (Math.random() > 0.5 ? 0.5 : -0.5), 0, true)
        else bot.look(bot.entity.yaw, 0.2, true)
      } catch {}

      await sleep(500)
      try { bot.look(bot.entity.yaw, 0, true) } catch {}
    }
  }

  // ================ MOVEMENT LOOP ================
  async function movementLoop() {
    bot.setControlState("forward", true)
    let sprinting = false
    let sneaking = false

    setInterval(eatIfHungry, 7000)

    while (true) {
      if (!bot.entity) { await sleep(200); continue }

      // smooth random turn
      const yaw = bot.entity.yaw + (Math.random() * 0.6 - 0.3)
      try { bot.look(yaw, 0, true) } catch {}

      const space = isSpaceAhead(1, 1)
      const ground = groundAhead(1)
      const gap = gapLengthAhead(6)

      // obstacle ahead
      if (!space) {
        const headFree = isSpaceAhead(1, 2)
        if (headFree && ground && ground.boundingBox !== "empty") {
          bot.setControlState("jump", true)
          await sleep(200)
          bot.setControlState("jump", false)
        } else {
          try { bot.look(bot.entity.yaw + (Math.random() > 0.5 ? 1 : -1), 0, true) } catch {}
        }

        if (sprinting) { bot.setControlState("sprint", false); sprinting = false }
      }

      // gap parkour
      else if (gap >= 2) {
        if (!sprinting) {
          bot.setControlState("sprint", true)
          sprinting = true
        }
        bot.setControlState("jump", true)
        await sleep(300)
        bot.setControlState("jump", false)
      }

      // normal movement
      else {
        if (!sprinting && Math.random() < SPRINT_CHANCE) {
          bot.setControlState("sprint", true)
          sprinting = true
        } else if (sprinting && Math.random() < 0.15) {
          bot.setControlState("sprint", false)
          sprinting = false
        }

        if (!sneaking && Math.random() < SNEAK_CHANCE) {
          bot.setControlState("sneak", true)
          sneaking = true
          await sleep(700 + Math.random() * 400)
          bot.setControlState("sneak", false)
          sneaking = false
        }

        if (Math.random() < JUMP_CHANCE * 0.4) {
          bot.setControlState("jump", true)
          await sleep(200)
          bot.setControlState("jump", false)
        }
      }

      await sleep(MOVE_INTERVAL)
    }
  }

  // ================ AUTO SLEEP ================
  async function autoSleepLoop() {
    while (true) {
      await sleep(2500)

      if (!bot.time) continue
      if (bot.time.timeOfDay <= 13000 || bot.isSleeping) continue

      const bed = bot.findBlock({
        matching: b => b.name && b.name.includes("bed"),
        maxDistance: 80
      })
      if (!bed) continue

      const target = bed.position
      while (bot.entity && bot.entity.position.distanceTo(target) > 2) {
        const dx = target.x - bot.entity.position.x
        const dz = target.z - bot.entity.position.z
        const yaw = Math.atan2(-dx, -dz)
        try { bot.look(yaw, 0, true) } catch {}

        bot.setControlState("forward", true)
        if (Math.random() < 0.1) {
          bot.setControlState("jump", true)
          await sleep(200)
          bot.setControlState("jump", false)
        }
        await sleep(250)
      }

      bot.setControlState("forward", false)

      try {
        await bot.sleep(bot.blockAt(target))
      } catch {}
    }
  }

  // ================ EVENTS ================
  bot.on("spawn", () => {
    movementLoop()
    idleHeadLoop()
    autoSleepLoop()
  })

 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
let reconnecting = false

function restartBot() {
  if (reconnecting) return
  reconnecting = true

  console.log("\n[!] Bot disconnected — trying again in 15s...\n")

  // stop old bot cleanly
  try { bot.quit() } catch {}

  bot = null

  setTimeout(() => {
    reconnecting = false
    console.log("[+] Reconnecting now...")
    startBot()   // FULL fresh start
  }, 15000)
}

// block all error spam
bot.on("error", () => {})
bot.on("kicked", () => {})
bot.on("end", restartBot)
bot.on("kicked", restartBot)
bot.on("error", restartBot)
}

// ------------------------------
//      FIRST START
// ------------------------------
startBot()
