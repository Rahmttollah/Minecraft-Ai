

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

  // final_bot_v2_pathfinder_pvp_crafting.js
// Upgraded: day-night tasks, strict-chop (no mining other blocks), aggressive PvP, craft tools, improved auto-sleep
const mineflayer = require("mineflayer")
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder")
const vec3 = require("vec3")

const bot = mineflayer.createBot({
  host: "rahmttollahai.aternos.me",
  port: 48219,
  username: "AlexBot"
})
bot.loadPlugin(pathfinder)

// ---------- Globals ----------
let mcData
let lastCommandTime = Date.now()
let autoMode = true
let isDigging = false
let guardInterval = null
let lastChatAt = 0

// ---------- helpers ----------
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)) }
function cleanMessage(msg){ if(!msg) return ""; return msg.replace(/§./g,"").replace(/<.*?>/g,"").trim().toLowerCase() }
function rateLimitedChat(text, min=6000){ const now=Date.now(); if(now-lastChatAt<min) return; lastChatAt=now; try{bot.chat(text)}catch(e){} }

// ---------- setup movements ----------
function setupMovements(){
  try {
    mcData = require("minecraft-data")(bot.version)
    bot.movements = new Movements(bot, mcData)
    bot.movements.allowSprinting = true
    bot.pathfinder.setMovements(bot.movements)
  } catch(e){ console.log("setupMovements:", e && e.message) }
}

// ---------- Geyser player detection ----------
function getGeyserPlayer(name){
  if(!name) return null
  const low = name.toLowerCase()
  const list = Object.values(bot.players)
  return (
    list.find(p=>p.username?.toLowerCase() === "."+low) ||
    list.find(p=>p.username?.toLowerCase().includes("."+low)) ||
    list.find(p=>p.username?.toLowerCase().includes(low)) ||
    list.find(p=>p.username?.startsWith(".")) ||
    null
  )
}

// ---------- safe dig only for target block ----------
async function safeDigTarget(block){
  if(!block || isDigging) return false
  isDigging = true
  try {
    // cancel any path goal
    try{ bot.pathfinder.setGoal(null) } catch(e){}
    // confirm block still exists and is target-type before dig
    const current = bot.blockAt(block.position)
    if(!current || current.name !== block.name) {
      isDigging = false
      return false
    }
    await bot.dig(current)
    return true
  } catch(e){
    console.log("safeDigTarget err", e && e.message)
    return false
  } finally { isDigging = false }
}

// ---------- equipment helpers ----------
async function autoEquipArmor(){
  const slots = ["helmet","chestplate","leggings","boots"]
  for(const s of slots){
    const it = bot.inventory.items().find(i=>i && i.name && i.name.includes(s))
    if(it) await bot.equip(it,s).catch(()=>{})
  }
}
function equipToolForBlock(block){
  if(!block) return
  const name = block.name || ""
  const inv = bot.inventory.items()
  if(name.includes("log") || name.includes("wood")){
    const axe = inv.find(i=>i.name && i.name.includes("axe"))
    if(axe) bot.equip(axe,"hand").catch(()=>{})
  } else if(name.includes("stone") || name.includes("ore")){
    const pick = inv.find(i=>i.name && i.name.includes("pickaxe"))
    if(pick) bot.equip(pick,"hand").catch(()=>{})
  } else {
    const sword = inv.find(i=>i.name && i.name.includes("sword"))
    if(sword) bot.equip(sword,"hand").catch(()=>{})
  }
}

// ---------- eating helpers ----------
function hasFood(){
  return bot.inventory.items().some(i=>i && ["bread","apple","cooked","steak","pork","chicken","carrot","potato"].some(f=>i.name.includes(f)))
}
async function eatIfHungry(){
  try {
    if(typeof bot.food === "number" && bot.food > 16) return true
    const f = bot.inventory.items().find(i=>i && ["bread","apple","cooked","steak","pork","chicken","carrot","potato"].some(x=>i.name.includes(x)))
    if(f){ await bot.equip(f,"hand").catch(()=>{}); await bot.consume(f).catch(()=>{}); return true }
    // pick up nearby dropped food
    const drop = Object.values(bot.entities).find(e=>e && e.name==="item" && e.item && e.position && bot.entity.position.distanceTo(e.position) < 18 &&
      ["bread","apple","cooked","steak","pork","chicken","carrot","potato"].some(x=> String(e.item?.type).toLowerCase().includes(x)))
    if(drop){ await walkToGoal(drop.position.x, drop.position.y, drop.position.z); await sleep(300); return await eatIfHungry() }
    return false
  } catch(e){ console.log("eatIfHungry err", e && e.message); return false }
}

// ---------- crafting tools (wooden -> stone) ----------
async function craftToolIfPossible(){
  try {
    if(!mcData) return false
    // helper to try craft given item name like 'wooden_pickaxe'
    const tryCraft = async (itemName, amount=1) => {
      const item = mcData.itemsByName[itemName]
      if(!item) return false
      const recipes = bot.recipesFor(item.id, null, 1)
      if(!recipes || recipes.length===0) return false
      // pick first recipe that we can craft (should be)
      const r = recipes[0]
      // if recipe requires crafting table and none present, try craft table creation? We'll craft on ground if shapeless/simple recipe (sticks/planks)
      try {
        await bot.craft(r, amount, null)
        rateLimitedChat(`Crafted ${itemName}`, 7000)
        return true
      } catch(e){ /* can't craft now */ return false }
    }

    // If no tool, try craft wooden axe/pick
    const hasAXE = bot.inventory.items().some(i=>i && (i.name.includes("axe")))
    const hasPICK = bot.inventory.items().some(i=>i && (i.name.includes("pickaxe")))
    if(!hasAXE) {
      // prefer stone axe if cobble+stick else wooden axe
      const craftedStone = await tryCraft("stone_axe")
      if(craftedStone) return true
      const craftedWood = await tryCraft("wooden_axe")
      if(craftedWood) return true
    }
    if(!hasPICK) {
      const craftedStone = await tryCraft("stone_pickaxe")
      if(craftedStone) return true
      const craftedWood = await tryCraft("wooden_pickaxe")
      if(craftedWood) return true
    }
    return false
  } catch(e){ console.log("craftToolIfPossible err", e && e.message); return false }
}

// ---------- pathfinder wrappers ----------
function ensureMovements(){
  if(!mcData) {
    try{ mcData = require("minecraft-data")(bot.version) } catch(e){}
  }
  if(!bot.movements && mcData){
    bot.movements = new Movements(bot, mcData)
    bot.movements.allowSprinting = true
    bot.pathfinder.setMovements(bot.movements)
  }
}

async function walkToGoal(x,y,z, timeoutMs=25000){
  ensureMovements()
  try{ bot.pathfinder.setGoal(null) } catch(e){}
  const goal = new goals.GoalBlock(Math.floor(x), Math.floor(y), Math.floor(z))
  try{ bot.pathfinder.setGoal(goal) } catch(e){ console.log("walkToGoal setGoal err", e && e.message) }
  const start=Date.now()
  while(Date.now()-start < timeoutMs){
    const pos = bot.entity.position
    const dist = Math.hypot(pos.x-x, pos.z-z)
    if(dist < 1.6){ try{ bot.pathfinder.setGoal(null) }catch(e){}; return true }
    await sleep(300)
  }
  try{ bot.pathfinder.setGoal(null) } catch(e){}
  return false
}

async function walkToNear(x,y,z, range=2, timeoutMs=20000){
  ensureMovements()
  try{ bot.pathfinder.setGoal(null) } catch(e){}
  const goal = new goals.GoalNear(Math.floor(x), Math.floor(y), Math.floor(z), range)
  try{ bot.pathfinder.setGoal(goal) } catch(e){ console.log("walkToNear setGoal err", e && e.message) }
  const start=Date.now()
  while(Date.now()-start < timeoutMs){
    const pos=bot.entity.position
    if(Math.hypot(pos.x-x,pos.z-z) < range+0.6){ try{ bot.pathfinder.setGoal(null) } catch(e){}; return true }
    await sleep(300)
  }
  try{ bot.pathfinder.setGoal(null) } catch(e){}
  return false
}

// ---------- chop tree (only logs) ----------
async function chopTreeFull(){
  const base = bot.findBlock({ maxDistance: 48, matching: b => b.name && (b.name.includes("log") || b.name.includes("wood")) })
  if(!base){ rateLimitedChat("Tree nahi mila",4000); return false }
  rateLimitedChat("Tree found — going",4000)
  const ok = await walkToNear(base.position.x, base.position.y, base.position.z, 2, 20000)
  if(!ok){ rateLimitedChat("Can't reach tree",4000); return false }
  // scan vertical logs
  const logs=[]
  for(let i=0;i<30;i++){
    const pos=base.position.offset(0,i,0)
    const blk = bot.blockAt(pos)
    if(blk && blk.name && (blk.name.includes("log")||blk.name.includes("wood"))) logs.push(blk)
  }
  rateLimitedChat(`Cutting ${logs.length} logs...`,4000)
  for(const l of logs){
    // ensure we only dig logs; if something else is at that pos skip
    const cur = bot.blockAt(l.position)
    if(!cur || !(cur.name.includes("log")||cur.name.includes("wood"))) continue
    equipToolForBlock(cur)
    await safeDigTarget(cur)
    await sleep(220)
  }
  await collectNearbyItems(12)
  rateLimitedChat("Tree chopped ✔",4000)
  return true
}

// ---------- item collection ----------
async function collectNearbyItems(radius=12){
  const items = Object.values(bot.entities).filter(e=>e && e.name==="item" && e.position && bot.entity.position.distanceTo(e.position)<=radius)
  if(!items.length) return
  for(const it of items){
    try {
      await walkToNear(it.position.x, it.position.y, it.position.z, 1, 12000)
      await sleep(200)
    } catch(e){ console.log("collect err", e && e.message) }
  }
}

// ---------- find function ----------
async function findThing(what, username){
  if(!what) return rateLimitedChat("Find kya?",4000)
  what=what.toLowerCase()
  if(what==="zombie"||what==="mob"){
    const mob = bot.nearestEntity(e=>e && e.type==="mob" && e.name && e.name.includes("zombie"))
    if(!mob) return rateLimitedChat("Zombie nahi mila",4000)
    rateLimitedChat("Zombie -> going",4000)
    await walkToNear(mob.position.x, mob.position.y, mob.position.z, 1, 20000)
    return
  }
  if(what==="village"){
    const markers=["bed","bell","composter","lectern","loom"]
    const b = bot.findBlock({ maxDistance: 220, matching: bl => markers.some(m=>bl.name && bl.name.includes(m)) })
    if(!b) return rateLimitedChat("Village nahi mila",4000)
    rateLimitedChat("Village -> going",4000)
    await walkToNear(b.position.x,b.position.y,b.position.z,2,30000)
    return
  }
  if(what==="chest"){
    const ch = bot.findBlock({ maxDistance: 150, matching: bl => bl.name && bl.name.includes("chest") })
    if(!ch) return rateLimitedChat("Chest nahi mila",4000)
    await walkToNear(ch.position.x,ch.position.y,ch.position.z,1,20000)
    return
  }
  rateLimitedChat("Find unknown",4000)
}

// ---------- guard ----------
async function startGuardForPlayer(playerName){
  const p = getGeyserPlayer(playerName)
  if(!p || !p.entity){ rateLimitedChat("Player detect nahi",4000); return false }
  rateLimitedChat("Guarding " + p.username,4000)
  // first approach then follow
  await walkToNear(p.entity.position.x,p.entity.position.y,p.entity.position.z,2,20000)
  bot.pathfinder.setGoal(new goals.GoalFollow(p.entity, 2), true)
  return true
}

// ---------- pvp decision & engage ----------
function shouldFight(target){
  if(!target || !target.name) return false
  const name = target.name.toLowerCase()
  if(name.includes("creeper") || name.includes("witch")) return false
  const botHP = (bot.health || 20)
  const hasWeapon = bot.inventory.items().some(i=>i && (i.name.includes("sword")||i.name.includes("axe")))
  if(hasWeapon && botHP > 6) return true
  if(["zombie","skeleton","spider"].some(m=>name.includes(m)) && botHP>10) return true
  return false
}

async function engageHostile(target){
  if(!target) return false
  try {
    // equip best weapon
    const inv = bot.inventory.items()
    const sword = inv.find(i=>i && i.name && (i.name.includes("sword")||i.name.includes("axe")))
    if(sword) await bot.equip(sword, "hand").catch(()=>{})
    // approach using GoalFollow/GoalNear
    await walkToNear(target.position.x, target.position.y, target.position.z, 1, 20000)
    // attack loop until dead or escape
    let attempts=0
    while(target && target.position && (target.health === undefined || target.health > 0) && attempts++ < 10){
      await bot.lookAt(target.position, true)
      await attackEntity(target)
      await sleep(400)
      // refresh entity ref
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


















      
// ---------- disconnect ----------

  // =====================================================
  //               AUTO-RESTART (12 sec delay)
  // =====================================================
  
  let reconnecting = false

  function restartBot() {
    if (reconnecting) return
    reconnecting = true

    console.log("\n[!] Disconnected — retry in 20s...\n")

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
