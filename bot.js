

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
      target = bot.entities[target.id]
    }
    await collectNearbyItems(8)
    await eatIfHungry()
    return true
  } catch(e){ console.log("engageHostile err", e && e.message); return false }
}

// ---------- auto sleep improved ----------
async function autoSleepCheck(){
  try {
    if(!bot.time) return
    const tod = bot.time.timeOfDay
    if(typeof tod === "number" && tod > 13000 && !bot.isSleeping){
      rateLimitedChat("Night -> searching bed", 10000)
      // wider search: try 60 then 120
      let bed = bot.findBlock({ maxDistance: 60, matching: b=>b.name && b.name.includes("bed") })
      if(!bed) bed = bot.findBlock({ maxDistance: 120, matching: b=>b.name && b.name.includes("bed") })
      if(!bed) return
      const ok = await walkToNear(bed.position.x, bed.position.y, bed.position.z, 1, 25000)
      if(!ok) { rateLimitedChat("Can't reach bed",10000); return }
      try { await bot.sleep(bot.blockAt(bed.position)); rateLimitedChat("Soya ✔",10000); } catch(e){
        rateLimitedChat("Bed occupied -> nudge",10000)
        const occ = bot.nearestEntity(e=>e.type==="player" && e.position.distanceTo(bed.position) < 2)
        if(occ){ try{ bot.attack(occ) } catch(e){}; await sleep(400) }
        try{ await bot.sleep(bot.blockAt(bed.position)); rateLimitedChat("Soya ab ✔",10000); } catch(e){ rateLimitedChat("Bed still occupied",10000) }
      }
    }
  } catch(e){ console.log("autoSleepCheck err", e && e.message) }
}

// ---------- autoplayer main loop ----------
async function autoLoop(){
  while(true){
    try{
      await sleep(1200)
      await autoEquipArmor()
      await eatIfHungry()
      await craftToolIfPossible()
      await autoSleepCheck()

      // always available tasks when autoMode true
      if(autoMode){
        // check hostiles first (aggressive)
        const nearHostiles = Object.values(bot.entities).filter(e=>e && e.type==="mob" && e.position && bot.entity.position.distanceTo(e.position) < 12)
        if(nearHostiles.length){
          // pick best hostile
          let target = nearHostiles.find(h=>h.name && (h.name.includes("zombie")||h.name.includes("skeleton")||h.name.includes("spider")))
          if(!target) target = nearHostiles[0]
          if(target){
            if(shouldFight(target)){
              rateLimitedChat("Enemy spotted — fight",7000)
              await engageHostile(target)
              continue
            } else {
              // avoid
              rateLimitedChat("Enemy spotted — avoid",7000)
              const pos = bot.entity.position
              const away = { x: pos.x + (pos.x - target.position.x)*2, y: pos.y, z: pos.z + (pos.z - target.position.z)*2 }
              await walkToGoal(away.x, away.y, away.z, 12000)
              continue
            }
          }
        }

        // collect nearby items
        await collectNearbyItems(10)

        // do farming if crop nearby
        const crop = bot.findBlock({ maxDistance:18, matching: b=>b.name && (b.name.includes("wheat")||b.name.includes("carrots")||b.name.includes("potatoes")||b.name.includes("beetroots")) })
        if(crop){ await walkToNear(crop.position.x,crop.position.y,crop.position.z,1,12000); await safeDigTarget(bot.blockAt(crop.position)); await collectNearbyItems(6); continue }

        // chop trees if found
        const tree = bot.findBlock({ maxDistance:28, matching: b=>b.name && (b.name.includes("log")||b.name.includes("wood")) })
        if(tree){ await chopTreeFull(); continue }

        // wander/explore
        const x = bot.entity.position.x + (Math.random()*12 - 6)
        const z = bot.entity.position.z + (Math.random()*12 - 6)
        await walkToGoal(x, bot.entity.position.y, z, 10000)
      }

    } catch(e){
      console.log("autoLoop err", e && e.stack || e)
    }
  }
}

// ---------- pathfinder logs (reduced) ----------
bot.on('path_update', r => { try { if(r && r.status && r.status !== 'noPath') console.log('[path_update]', r.status, 'len=' + r.path.length) } catch(e){} })
bot.on('goal_reached', g => { console.log('[pathfinder] goal_reached'); rateLimitedChat('Reached', 9000) })
bot.on('path_reset', reason => { console.log('[pathfinder] path_reset', reason); rateLimitedChat('Path reset', 9000) })

// ---------- spawn ----------
bot.on('spawn', () => {
  setupMovements()
  rateLimitedChat("AI BOT ready — Pathfinder + PvP + Crafting", 9000)
  autoLoop().catch(e=>console.log("autoLoop start err", e && e.message))
})

// ---------- chat commands ----------
bot.on('chat', async (username, message) => {
  if(!bot || username === bot.username) return
  const raw = cleanMessage(message)
  const parts = raw.split(/\s+/).filter(Boolean)
  lastCommandTime = Date.now()
  autoMode = false

  try{
    if(raw === "follow me" || raw === "follow"){
      const p = getGeyserPlayer(username)
      if(!p || !p.entity){ rateLimitedChat("Player detect nahi",8000); console.log("players", bot.players); return }
      rateLimitedChat("Following " + p.username,8000)
      bot.pathfinder.setGoal(new goals.GoalFollow(p.entity, 2), true); return
    }

    if(parts[0] === "guard"){
      await startGuardForPlayer(username); return
    }

    if(["go","goto","jao","chalo","jaa"].includes(parts[0])){
      const x = parseFloat(parts[1]), y = parseFloat(parts[2]), z = parseFloat(parts[3])
      if(isNaN(x)||isNaN(y)||isNaN(z)) return rateLimitedChat("Usage: go x y z",8000)
      rateLimitedChat(`Going to ${x} ${y} ${z}`,8000)
      await walkToGoal(x,y,z); return
    }

    if(parts[0] === "find" || parts[0] === "dhoondo" || parts[0] === "dhoond"){
      await findThing(parts[1], username); return
    }

    if(raw === "chop tree" || raw === "choptree"){ await chopTreeFull(); return }

    if(parts[0] === "bridge"){
      const len = parseInt(parts[1]) || 6
      rateLimitedChat("Bridge start "+len,8000)
      const plank = bot.inventory.items().find(i=>i.name && i.name.includes("planks"))
      if(!plank) return rateLimitedChat("Planks chahiye",8000)
      await bot.equip(plank,"hand").catch(()=>{})
      for(let i=0;i<len;i++){
        const under = bot.blockAt(bot.entity.position.offset(0,-1,0))
        try{ if(under && under.name === "air"){ const ref = bot.blockAt(bot.entity.position); if(ref) await bot.placeBlock(ref, vec3(0,-1,0)).catch(()=>{}) } } catch(e){}
        await sleep(350)
      }
      rateLimitedChat("Bridge done",8000); return
    }

    if(parts[0] === "mode"){
      if(parts[1] === "auto"){ autoMode=true; return rateLimitedChat("Auto ON",8000) }
      if(parts[1] === "manual"){ autoMode=false; return rateLimitedChat("Auto OFF",8000) }
    }

    if(parts[0] === "inv"){
      const items = bot.inventory.items().map(i=>`${i.name} x${i.count}`).slice(0,20)
      return rateLimitedChat("Inv: "+items.join(", "),8000)
    }

    rateLimitedChat("Samjha: "+message,8000)
  } catch(e){ console.log("chat handler err", e && e.stack || e) }
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
