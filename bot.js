// =============================================================
//          FULL AI BOT + AUTO-RESTART (NO TERMINAL REQUIRED)
// =============================================================

function startBot() {

  // ------------------ IMPORTS ------------------
  const mineflayer = require("mineflayer")
  const { pathfinder, Movements, goals } = require("mineflayer-pathfinder")
  const vec3 = require("vec3")

  // ------------------ CREATE BOT ------------------
  let bot = mineflayer.createBot({
    host: "rahmttollahai.aternos.me",
    port: 48219,
    username: "AlexBot"
  })

  bot.loadPlugin(pathfinder)

  // ------------------ GLOBALS ------------------
  let mcData
  let autoMode = true
  let isDigging = false
  let lastChatAt = 0
  let lastCommandTime = Date.now()

  // ------------------ HELPERS ------------------
  function sleep(ms) { return new Promise(r=>setTimeout(r,ms)) }
  function cleanMessage(msg){
    if(!msg) return ""
    return msg.replace(/§./g,"").replace(/<.*?>/g,"").trim().toLowerCase()
  }

  function rateLimitedChat(msg, timeout=5000){
    const now = Date.now()
    if(now - lastChatAt < timeout) return
    lastChatAt = now
    try { bot.chat(msg) } catch {}
  }

  // ------------------ GEYSER PLAYER FIX ------------------
  function getGeyserPlayer(name){
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

  // ------------------ SETUP MOVEMENTS ------------------
  function setupMoves(){
    try {
      mcData = require("minecraft-data")(bot.version)
      bot.movements = new Movements(bot, mcData)
      bot.movements.allowSprinting = true
      bot.pathfinder.setMovements(bot.movements)
    } catch(e){}
  }

  // ------------------ PATHFIND BLOCK ------------------
  async function walkToGoal(x,y,z,timeout=25000){
    setupMoves()
    try { bot.pathfinder.setGoal(null) } catch {}
    bot.pathfinder.setGoal(new goals.GoalBlock(x,y,z))
    const start = Date.now()

    while(Date.now() - start < timeout){
      const pos = bot.entity.position
      const dist = Math.hypot(pos.x-x,pos.z-z)
      if(dist < 1.6){
        try { bot.pathfinder.setGoal(null) } catch {}
        return true
      }
      await sleep(250)
    }
    try { bot.pathfinder.setGoal(null) } catch {}
    return false
  }

  async function walkToNear(x,y,z,range=2,time=20000){
    setupMoves()
    try { bot.pathfinder.setGoal(null) } catch {}
    bot.pathfinder.setGoal(new goals.GoalNear(x,y,z,range))

    const start = Date.now()
    while(Date.now() - start < time){
      const pos = bot.entity.position
      if(Math.hypot(pos.x-x,pos.z-z) < range+0.5){
        try { bot.pathfinder.setGoal(null) } catch {}
        return true
      }
      await sleep(250)
    }
    try { bot.pathfinder.setGoal(null) } catch {}
    return false
  }

  // ------------------ SAFE DIG ONLY TARGET ------------------
  async function safeDig(block){
    if(!block || isDigging) return
    isDigging = true
    try {
      const real = bot.blockAt(block.position)
      if(!real || real.name !== block.name){ isDigging=false; return }
      await bot.dig(real)
    } catch(e){}
    isDigging=false
  }

  // ------------------ ATTACK FUNCTION ------------------
  async function attackEntity(target){
    if(!target) return
    try {
      await bot.lookAt(target.position, true)
      bot.setControlState("sprint", true)
      bot.attack(target)
      await sleep(200)
      bot.setControlState("sprint", false)
    }catch{}
  }

  // ------------------ SHOULD FIGHT LOGIC ------------------
  function shouldFight(target){
    if(!target || !target.name) return false
    const name = target.name.toLowerCase()
    if(name.includes("creeper") || name.includes("witch")) return false
    if(bot.health > 10) return true
    return false
  }

  // ------------------ ENGAGE HOSTILE ------------------
  async function fightHostile(target){
    if(!target) return false
    await walkToNear(target.position.x, target.position.y, target.position.z, 1)
    for(let i=0;i<6;i++){
      if(!target || target.health <= 0) break
      await attackEntity(target)
      await sleep(300)
      target = bot.entities[target.id]
    }
    return true
  }

  // ------------------ ITEM COLLECT ------------------
  async function collectItems(radius=10){
    const items = Object.values(bot.entities).filter(e=>e.name==="item" && bot.entity.position.distanceTo(e.position)<radius)
    for(const it of items){
      await walkToNear(it.position.x,it.position.y,it.position.z,1)
      await sleep(200)
    }
  }

  // ------------------ TREE CUT ------------------
  async function chopTree(){
    const base = bot.findBlock({maxDistance:40, matching:b=>b.name.includes("log")})
    if(!base){ rateLimitedChat("Tree nahi mila"); return }

    rateLimitedChat("Tree found — going")
    await walkToNear(base.position.x,base.position.y,base.position.z,2)

    // full height scan
    const logs=[]
    for(let i=0;i<25;i++){
      const pos=base.position.offset(0,i,0)
      const blk=bot.blockAt(pos)
      if(blk && blk.name.includes("log")) logs.push(blk)
    }

    rateLimitedChat(`Cutting ${logs.length} logs...`)
    for(const l of logs){
      const b=bot.blockAt(l.position)
      if(!b || !b.name.includes("log")) continue
      await safeDig(b)
      await sleep(150)
    }
    await collectItems(12)
    rateLimitedChat("Tree chopped ✔")
  }

  // ------------------ AUTO SLEEP ------------------
  async function autoSleep(){
    if(!bot.time) return
    const t = bot.time.timeOfDay
    if(t > 13000 && !bot.isSleeping){
      const bed = bot.findBlock({maxDistance:100, matching:b=>b.name.includes("bed")})
      if(!bed) return
      rateLimitedChat("Night — going to bed")
      await walkToNear(bed.position.x,bed.position.y,bed.position.z,1)
      try { await bot.sleep(bot.blockAt(bed.position)); rateLimitedChat("Soya ✔") }
      catch{}
    }
  }

  // ------------------ AUTO LOOP ------------------
  async function autoLoop(){
    while(true){
      try{

        // Hostile detection
        const hostile = bot.nearestEntity(e=>e.type==="mob" && bot.entity.position.distanceTo(e.position)<10)
        if(hostile){
          if(shouldFight(hostile)){
            await fightHostile(hostile)
            continue
          }
        }

        // Tree
        const tree = bot.findBlock({maxDistance:25, matching:b=>b.name.includes("log")})
        if(tree) await chopTree()

        await autoSleep()
        await collectItems(10)

        // wander
        const pos = bot.entity.position
        const nx = pos.x + (Math.random()*8-4)
        const nz = pos.z + (Math.random()*8-4)
        await walkToGoal(nx,pos.y,nz)

      }catch(e){}
    }
  }

  // ------------------ CHAT COMMANDS ------------------
  bot.on("chat", async (username, message)=>{
    if(username===bot.username) return
    autoMode=false
    const msg = cleanMessage(message)
    const part = msg.split(" ")

    if(msg==="follow me" || msg==="follow"){
      const p=getGeyserPlayer(username)
      if(!p||!p.entity) return rateLimitedChat("Player detect nahi")
      rateLimitedChat("Following "+p.username)
      bot.pathfinder.setGoal(new goals.GoalFollow(p.entity,2), true)
      return
    }

    if(msg==="chop tree"){
      await chopTree()
      return
    }

    if(["go","goto"].includes(part[0])){
      const x=parseFloat(part[1]), y=parseFloat(part[2]), z=parseFloat(part[3])
      rateLimitedChat("Going...")
      await walkToGoal(x,y,z)
      return
    }

    rateLimitedChat("Samjha: "+message)
  })

  // ------------------ SPAWN ------------------
  bot.on("spawn",()=>{
    setupMoves()
    rateLimitedChat("AI BOT Online ✔")
    autoLoop()
  })

  // ======================================================
  //          ★ AUTO-RESTART: NO TERMINAL REQUIRED ★
  // ======================================================

  function restartBot(){
    console.log("BOT OFFLINE — restarting in 3 seconds...")
    try { bot.quit() } catch{}
    bot = null
    setTimeout(()=>{
      console.log("Rebooting fresh bot…")
      startBot()
    }, 3000)
  }

  bot.on("end", restartBot)
  bot.on("kicked", restartBot)
  bot.on("error", restartBot)

}

// ------------------------------
//      START FIRST BOOT
// ------------------------------
startBot()
