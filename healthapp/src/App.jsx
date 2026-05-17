import { useState, useEffect, useCallback, useRef } from 'react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts'
import { parseFoodEntry, parseExerciseEntry, parseWeightEntry, getMealOpinion } from './gemini'
import { store } from './storage'
import { NUTR, ZERO, calcGoals } from './goals'

// ─── Palette ──────────────────────────────────────────────────────
const BG='#000',CARD='#1C1C1E',CARD2='#2C2C2E',CARD3='#3A3A3C'
const RED='#FF375F',GRN='#30D158',ORG='#FF9F0A',BLU='#32ADE6'
const PUR='#BF5AF2',YEL='#FFD60A',CYN='#5AC8FA'
const TXT='#fff',TS='rgba(235,235,245,0.6)',TT='rgba(235,235,245,0.22)'
const ACT_LABELS={sedentary:'Sedentary',light:'Lightly Active',moderate:'Moderately Active',active:'Very Active',extra:'Extra Active'}
const GOAL_LABELS={lose:'Lose Weight',maintain:'Maintain',gain:'Gain Muscle'}

const fmtN=(v,u)=>{
  if(!v||v===0)return`0${u}`
  if(u==='kcal'||u==='ml')return`${Math.round(v)}${u}`
  if(u==='g'&&v>=10)return`${Math.round(v)}${u}`
  return`${(+v).toFixed(1)}${u}`
}

// ─── Shared UI Components (defined OUTSIDE App to prevent remount) ─
const Card=({children,mb=14,p=20})=>(
  <div style={{background:CARD,borderRadius:22,padding:p,marginBottom:mb}}>{children}</div>
)
const CardHead=({t,s})=>(
  <div style={{marginBottom:14}}>
    <div style={{color:TXT,fontSize:15,fontWeight:700}}>{t}</div>
    {s&&<div style={{color:TS,fontSize:12,marginTop:2}}>{s}</div>}
  </div>
)
const PBar=({label,value,max,color,unit='g'})=>{
  const pct=Math.min(((value||0)/Math.max(max,1))*100,100)
  return(
    <div style={{marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
        <span style={{color:TS,fontSize:13}}>{label}</span>
        <span style={{color:TXT,fontSize:13,fontWeight:600}}>{fmtN(value||0,unit)}<span style={{color:TS,fontWeight:400}}>/{max}{unit}</span></span>
      </div>
      <div style={{height:6,background:CARD3,borderRadius:3,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:3}}/>
      </div>
    </div>
  )
}
const Stepper=({label,value,onChange,min=0,max=300,step=1,unit=''})=>(
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
    <div style={{color:TXT,fontSize:14}}>{label}</div>
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <button onClick={()=>onChange(Math.max(min,+(value-step).toFixed(2)))}
        style={{width:32,height:32,borderRadius:16,border:'none',background:CARD2,color:TXT,cursor:'pointer',fontSize:18}}>−</button>
      <div style={{color:GRN,fontWeight:700,fontSize:16,minWidth:70,textAlign:'center'}}>{value}<span style={{color:TS,fontSize:11}}>{unit}</span></div>
      <button onClick={()=>onChange(Math.min(max,+(value+step).toFixed(2)))}
        style={{width:32,height:32,borderRadius:16,border:'none',background:CARD2,color:TXT,cursor:'pointer',fontSize:18}}>+</button>
    </div>
  </div>
)
const MicroTile=({n,value,goal})=>{
  const pct=goal>0?Math.min(((value||0)/goal)*100,100):0
  return(
    <div style={{background:CARD2,borderRadius:14,padding:12,position:'relative'}}>
      {pct<25&&(value||0)>0&&<span style={{position:'absolute',top:7,right:9,fontSize:10}}>⚠️</span>}
      {pct>=100&&<span style={{position:'absolute',top:7,right:9,fontSize:10}}>✅</span>}
      <div style={{color:TS,fontSize:11,marginBottom:4,paddingRight:18}}>{n.l}</div>
      <div style={{color:n.c,fontSize:17,fontWeight:700,lineHeight:1}}>{fmtN(value||0,n.u)}</div>
      <div style={{height:3,background:CARD3,borderRadius:2,marginTop:7,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:n.c,borderRadius:2}}/>
      </div>
      <div style={{color:TT,fontSize:10,marginTop:3}}>{Math.round(pct)}% of {goal}{n.u}</div>
    </div>
  )
}

// ─── Time Picker Modal ─────────────────────────────────────────────
const TimePicker=({onConfirm,onCancel})=>{
  const now=new Date()
  const pad=n=>String(n).padStart(2,'0')
  const [h,setH]=useState(now.getHours())
  const [m,setM]=useState(now.getMinutes())
  const [useNow,setUseNow]=useState(true)

  const confirm=()=>{
    if(useNow){onConfirm(new Date());return}
    const d=new Date()
    d.setHours(h,m,0,0)
    onConfirm(d)
  }

  return(
    <div style={{position:'fixed',inset:0,zIndex:500,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
      <div onClick={onCancel} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}}/>
      <div style={{position:'relative',background:CARD,borderRadius:'24px 24px 0 0',padding:'24px 20px 40px',zIndex:1}}>
        <div style={{width:36,height:4,background:CARD3,borderRadius:2,margin:'0 auto 20px'}}/>
        <div style={{color:TXT,fontSize:17,fontWeight:700,marginBottom:6}}>When did you have this?</div>
        <div style={{color:TS,fontSize:13,marginBottom:20}}>Choose the time for this log entry</div>

        {/* Now vs Custom */}
        <div style={{display:'flex',background:CARD2,borderRadius:12,padding:4,marginBottom:20,gap:4}}>
          {[['now','⚡ Right Now'],['custom','🕐 Custom Time']].map(([id,lb])=>(
            <button key={id} onClick={()=>setUseNow(id==='now')}
              style={{flex:1,padding:'10px 4px',borderRadius:9,border:'none',cursor:'pointer',
                background:useNow===(id==='now')?CARD3:'transparent',
                color:useNow===(id==='now')?TXT:TS,fontWeight:useNow===(id==='now')?700:400,
                fontSize:14,fontFamily:'inherit',transition:'all .15s'}}>
              {lb}
            </button>
          ))}
        </div>

        {/* Current time display */}
        {useNow&&(
          <div style={{background:CARD2,borderRadius:14,padding:'16px 20px',textAlign:'center',marginBottom:20}}>
            <div style={{color:GRN,fontSize:36,fontWeight:700,letterSpacing:2}}>
              {pad(now.getHours())}:{pad(now.getMinutes())}
            </div>
            <div style={{color:TS,fontSize:12,marginTop:4}}>
              {now.toLocaleDateString('en',{weekday:'long',month:'short',day:'numeric'})}
            </div>
          </div>
        )}

        {/* Custom time picker */}
        {!useNow&&(
          <div style={{background:CARD2,borderRadius:14,padding:'20px',marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:16}}>
              {/* Hours */}
              <div style={{textAlign:'center'}}>
                <button onClick={()=>setH(p=>(p+1)%24)}
                  style={{display:'block',width:'100%',background:'none',border:'none',color:TS,fontSize:22,cursor:'pointer',padding:'4px 0'}}>▲</button>
                <div style={{color:TXT,fontSize:44,fontWeight:700,minWidth:70,textAlign:'center'}}>{pad(h)}</div>
                <button onClick={()=>setH(p=>(p-1+24)%24)}
                  style={{display:'block',width:'100%',background:'none',border:'none',color:TS,fontSize:22,cursor:'pointer',padding:'4px 0'}}>▼</button>
                <div style={{color:TT,fontSize:11,marginTop:4}}>Hour</div>
              </div>
              <div style={{color:TXT,fontSize:40,fontWeight:300,marginBottom:10}}>:</div>
              {/* Minutes */}
              <div style={{textAlign:'center'}}>
                <button onClick={()=>setM(p=>(p+5)%60)}
                  style={{display:'block',width:'100%',background:'none',border:'none',color:TS,fontSize:22,cursor:'pointer',padding:'4px 0'}}>▲</button>
                <div style={{color:TXT,fontSize:44,fontWeight:700,minWidth:70,textAlign:'center'}}>{pad(m)}</div>
                <button onClick={()=>setM(p=>(p-5+60)%60)}
                  style={{display:'block',width:'100%',background:'none',border:'none',color:TS,fontSize:22,cursor:'pointer',padding:'4px 0'}}>▼</button>
                <div style={{color:TT,fontSize:11,marginTop:4}}>Min</div>
              </div>
              {/* AM/PM hint */}
              <div style={{textAlign:'center',marginBottom:10}}>
                <div style={{color:GRN,fontSize:15,fontWeight:700}}>{h<12?'AM':'PM'}</div>
                <div style={{color:TT,fontSize:11,marginTop:4}}>{h>12?h-12:h||12}:{pad(m)}</div>
              </div>
            </div>
          </div>
        )}

        <button onClick={confirm}
          style={{width:'100%',padding:16,background:GRN,border:'none',borderRadius:16,color:'#000',fontWeight:700,fontSize:16,cursor:'pointer',fontFamily:'inherit'}}>
          Confirm Time →
        </button>
      </div>
    </div>
  )
}

// ─── Entry Card ────────────────────────────────────────────────────
const EntryCard=({entry,goals,expanded,onToggle})=>{
  const p=entry.parsed||{}
  const conf={
    food:{icon:'🥗',color:RED,summary:`${Math.round(p.calories||0)} cal · ${Math.round(p.protein||0)}g protein`},
    exercise:{icon:'🏃',color:GRN,summary:`${p.duration||0} min · ${p.caloriesBurned||0} cal burned`},
    weight:{icon:'⚖️',color:BLU,summary:`${p.weight||0} kg`},
  }[entry.type]||{icon:'📝',color:TS,summary:''}
  const topNutrs=entry.type==='food'
    ?NUTR.filter(n=>n.cat!=='macro'&&(p[n.k]||0)>0&&goals[n.k]>0)
        .sort((a,b)=>((p[b.k]||0)/goals[b.k])-((p[a.k]||0)/goals[a.k])).slice(0,5)
    :[]
  return(
    <div style={{marginBottom:12}}>
      <div onClick={entry.type==='food'?onToggle:undefined} style={{cursor:entry.type==='food'?'pointer':'default'}}>
        <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
          <div style={{width:38,height:38,borderRadius:11,background:`${conf.color}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{conf.icon}</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <div style={{color:TXT,fontWeight:600,fontSize:14,flex:1,paddingRight:8}}>{p.name||p.activity||`Weight: ${p.weight}kg`}</div>
              <div style={{color:TT,fontSize:11,flexShrink:0}}>{new Date(entry.timestamp).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
            <div style={{color:TS,fontSize:12,marginTop:2}}>{conf.summary}</div>
            {entry.loadingOpinion&&<div style={{color:TT,fontSize:12,marginTop:6}}>⏳ Analyzing nutrition...</div>}
            {entry.opinion&&<div style={{color:GRN,fontSize:12,marginTop:6,lineHeight:1.5,fontStyle:'italic'}}>💡 {entry.opinion}</div>}
            {topNutrs.length>0&&(
              <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:8}}>
                {topNutrs.map(n=>(
                  <span key={n.k} style={{background:`${n.c}20`,color:n.c,fontSize:10,fontWeight:600,padding:'3px 8px',borderRadius:20}}>+{fmtN(p[n.k],n.u)} {n.l.split(' ').slice(-1)[0]}</span>
                ))}
                <span style={{background:CARD3,color:TS,fontSize:10,padding:'3px 8px',borderRadius:20}}>{expanded?'▲ less':'▼ all'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {expanded&&entry.type==='food'&&(
        <div style={{marginTop:12,marginLeft:50}}>
          <div style={{color:TT,fontSize:11,fontWeight:700,letterSpacing:.8,textTransform:'uppercase',marginBottom:8}}>Full Nutrient Breakdown</div>
          {['macro','vitamin','mineral'].map(cat=>(
            <div key={cat} style={{marginBottom:12}}>
              <div style={{color:TS,fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:.6,marginBottom:6}}>{cat==='macro'?'Macros':cat==='vitamin'?'Vitamins':'Minerals'}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                {NUTR.filter(n=>n.cat===cat).map(n=>(
                  <div key={n.k} style={{display:'flex',justifyContent:'space-between',background:CARD3,borderRadius:8,padding:'5px 10px'}}>
                    <span style={{color:TS,fontSize:11}}>{n.l}</span>
                    <span style={{color:(p[n.k]||0)>0?n.c:TT,fontSize:11,fontWeight:600}}>+{fmtN(p[n.k]||0,n.u)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Rings ─────────────────────────────────────────────────────────
const Rings=({tots,burned,goals})=>{
  const rs=[
    {r:82,v:tots.calories,max:goals.calories||2000,color:RED,label:'MOVE',unit:'kcal'},
    {r:62,v:burned,max:350,color:GRN,label:'EXERCISE',unit:'kcal'},
    {r:42,v:tots.protein,max:goals.protein||60,color:PUR,label:'PROTEIN',unit:'g'},
  ]
  return(
    <div style={{display:'flex',alignItems:'center',gap:16}}>
      <svg width={200} height={200} style={{transform:'rotate(-90deg)',flexShrink:0}}>
        {rs.map((r,i)=>{
          const circ=2*Math.PI*r.r,pct=Math.min(Math.max((r.v||0)/r.max,0),1)
          return(<g key={i}>
            <circle cx={100} cy={100} r={r.r} fill="none" stroke={`${r.color}22`} strokeWidth={16}/>
            {(r.v||0)>0&&<circle cx={100} cy={100} r={r.r} fill="none" stroke={r.color} strokeWidth={16} strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} strokeLinecap="round"/>}
          </g>)
        })}
      </svg>
      <div>{rs.map((r,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:i<2?16:0}}>
          <div style={{width:10,height:10,borderRadius:'50%',background:r.color,flexShrink:0}}/>
          <div>
            <div style={{color:r.color,fontSize:21,fontWeight:700,lineHeight:1.1}}>{Math.round(r.v||0)}<span style={{fontSize:11,color:TS,fontWeight:400}}> {r.unit}</span></div>
            <div style={{color:TS,fontSize:10,fontWeight:600,letterSpacing:.7,marginTop:2}}>{r.label}</div>
          </div>
        </div>
      ))}</div>
    </div>
  )
}

// ─── TODAY VIEW (top-level component, NOT inside App) ──────────────
const TodayView=({logs,tots,burned,goals,latestWt,expandedId,setExpandedId,showAll,setShowAll,profile})=>{
  const today=new Date().toISOString().split('T')[0]
  const tl=logs.filter(l=>l.date===today)
  const vitamins=NUTR.filter(n=>n.cat==='vitamin')
  const minerals=NUTR.filter(n=>n.cat==='mineral')
  const hour=new Date().getHours()
  const greet=hour<12?'Good morning ☀️':hour<17?'Good afternoon 🌤️':'Good evening 🌙'
  return(
    <div style={{padding:'0 16px 100px'}}>
      <div style={{paddingTop:54,marginBottom:24}}>
        <div style={{color:TS,fontSize:12,fontWeight:600,letterSpacing:1.2,textTransform:'uppercase'}}>{new Date().toLocaleDateString('en',{weekday:'long',month:'long',day:'numeric'})}</div>
        <div style={{color:TXT,fontSize:28,fontWeight:700,marginTop:4}}>{greet}{profile?.name?`, ${profile.name.split(' ')[0]}`:''}</div>
      </div>
      <Card>
        <CardHead t="Activity Rings" s="Move · Exercise · Protein"/>
        <Rings tots={tots} burned={burned} goals={goals}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8,marginTop:16}}>
          {[['GOAL',goals.calories||'—',TS],['EATEN',Math.round(tots.calories),RED],['BURNED',Math.round(burned),GRN],['LEFT',Math.max(0,Math.round((goals.calories||2000)-tots.calories+burned)),BLU]].map(([l,v,c])=>(
            <div key={l} style={{background:CARD2,borderRadius:10,padding:'9px 4px',textAlign:'center'}}>
              <div style={{color:TT,fontSize:9,fontWeight:700,letterSpacing:.5,marginBottom:3}}>{l}</div>
              <div style={{color:c,fontSize:18,fontWeight:700}}>{v}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHead t="Macronutrients"/>
        {NUTR.filter(n=>n.cat==='macro').map(n=><PBar key={n.k} label={n.l} value={tots[n.k]} max={goals[n.k]||1} color={n.c} unit={n.u}/>)}
      </Card>
      <Card>
        <CardHead t="Vitamins" s={profile?`Personalized for ${profile.age}yr ${profile.gender}`:''}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {(showAll?vitamins:vitamins.slice(0,6)).map(n=><MicroTile key={n.k} n={n} value={tots[n.k]} goal={goals[n.k]||1}/>)}
        </div>
        <button onClick={()=>setShowAll(!showAll)} style={{width:'100%',marginTop:10,padding:8,background:CARD2,border:'none',borderRadius:10,color:TS,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>{showAll?'▲ Show Less':'▼ Show All Vitamins'}</button>
      </Card>
      <Card>
        <CardHead t="Minerals"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {(showAll?minerals:minerals.slice(0,6)).map(n=><MicroTile key={n.k} n={n} value={tots[n.k]} goal={goals[n.k]||1}/>)}
        </div>
        <button onClick={()=>setShowAll(!showAll)} style={{width:'100%',marginTop:10,padding:8,background:CARD2,border:'none',borderRadius:10,color:TS,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>{showAll?'▲ Show Less':'▼ Show All Minerals'}</button>
      </Card>
      <Card>
        <CardHead t="Today's Timeline" s="Tap any meal to see full nutrient breakdown"/>
        {tl.length===0?(
          <div style={{textAlign:'center',padding:'16px 0'}}>
            <div style={{fontSize:44,marginBottom:10}}>🌱</div>
            <div style={{color:TS,fontSize:14}}>Start by logging your first meal!</div>
          </div>
        ):[...tl].sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp)).map((item,i,arr)=>(
          <div key={item.id}>
            <EntryCard entry={item} goals={goals} expanded={expandedId===item.id} onToggle={()=>setExpandedId(expandedId===item.id?null:item.id)}/>
            {i<arr.length-1&&<div style={{height:1,background:CARD3,margin:'4px 0 12px 50px'}}/>}
          </div>
        ))}
      </Card>
      {latestWt&&(
        <Card>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{color:TXT,fontSize:15,fontWeight:700}}>Current Weight</div><div style={{color:TS,fontSize:12,marginTop:2}}>Last recorded</div></div>
            <div><span style={{color:BLU,fontSize:44,fontWeight:700}}>{latestWt}</span><span style={{color:TS,fontSize:22}}> kg</span></div>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── LOG VIEW (top-level component — fixes keyboard bug) ───────────
const LOG_EX={
  food:['Had poha and masala chai for breakfast','Dal rice sabzi with 2 roti for lunch','Evening snack: 20g almonds and one banana','Dinner: palak paneer, 2 chapati, bowl of curd'],
  exercise:['30 minute morning yoga session','Jogged 5km in about 35 minutes','45 min strength training at gym','20-minute brisk evening walk'],
  weight:['My weight this morning is 70 kg','Weighed 68.5 kg today after workout','Evening weight: 71.2 kg'],
}

const LogView=({logs,onLog,busy})=>{
  const [inp,setInp]=useState('')
  const [itype,setItype]=useState('food')
  const [showTimePicker,setShowTimePicker]=useState(false)
  const taRef=useRef(null)
  const today=new Date().toISOString().split('T')[0]

  const handleLogPress=()=>{
    if(!inp.trim()||busy)return
    // blur keyboard first, then show time picker
    taRef.current?.blur()
    setTimeout(()=>setShowTimePicker(true),100)
  }
  const handleTimeConfirm=(chosenTime)=>{
    setShowTimePicker(false)
    onLog(inp,itype,chosenTime,()=>setInp(''))
  }

  return(
    <div style={{padding:'0 16px 100px'}}>
      <div style={{paddingTop:54,marginBottom:24}}>
        <div style={{color:TXT,fontSize:30,fontWeight:700}}>Log</div>
        <div style={{color:TS,fontSize:14,marginTop:4}}>Tell me what you ate, did, or weigh</div>
      </div>

      {/* Type switcher */}
      <div style={{display:'flex',background:CARD2,borderRadius:12,padding:4,marginBottom:16,gap:4}}>
        {[['food','🥗','Food'],['exercise','🏃','Exercise'],['weight','⚖️','Weight']].map(([id,ic,lb])=>(
          <button key={id} onClick={()=>setItype(id)}
            style={{flex:1,padding:'9px 4px',borderRadius:9,border:'none',cursor:'pointer',background:itype===id?CARD3:'transparent',color:itype===id?TXT:TS,fontWeight:itype===id?700:400,fontSize:13,fontFamily:'inherit',transition:'all .2s'}}>
            {ic} {lb}
          </button>
        ))}
      </div>

      {/* Input card */}
      <Card>
        <textarea
          ref={taRef}
          value={inp}
          onChange={e=>setInp(e.target.value)}
          rows={4}
          placeholder={{
            food:'"Had 2 chapati with dal makhani and lassi for lunch"',
            exercise:'"Did 30 min morning yoga"',
            weight:'"My weight is 72.5 kg"'
          }[itype]}
          style={{width:'100%',background:'transparent',border:'none',outline:'none',color:TXT,fontSize:16,resize:'none',fontFamily:'inherit',lineHeight:1.6,boxSizing:'border-box',caretColor:GRN}}
        />
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12,paddingTop:12,borderTop:`1px solid ${CARD3}`}}>
          <div style={{color:TS,fontSize:12}}>{itype==='food'?'🤖 AI analyzes 30 nutrients + gives insight':'🤖 AI calculates your data'}</div>
          <button onClick={handleLogPress} disabled={busy||!inp.trim()}
            style={{background:busy||!inp.trim()?CARD3:GRN,color:busy||!inp.trim()?TS:'#000',border:'none',borderRadius:20,padding:'9px 22px',fontWeight:700,fontSize:14,cursor:busy||!inp.trim()?'not-allowed':'pointer',fontFamily:'inherit',transition:'all .2s'}}>
            {busy?'⏳ Analyzing…':'Log It →'}
          </button>
        </div>
      </Card>

      {/* Examples */}
      <Card>
        <div style={{color:TS,fontSize:11,fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:12}}>Try These</div>
        {LOG_EX[itype].map((ex,i)=>(
          <button key={i} onClick={()=>setInp(ex)}
            style={{display:'block',width:'100%',textAlign:'left',background:CARD2,border:'none',borderRadius:12,padding:'11px 14px',marginBottom:i<3?8:0,color:TS,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
            <span style={{color:TT,marginRight:8}}>›</span>{ex}
          </button>
        ))}
      </Card>

      {/* Recent history */}
      {logs.length>0&&(
        <Card>
          <div style={{color:TS,fontSize:11,fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:12}}>Recent</div>
          {logs.slice(0,5).map((log,i)=>{
            const p=log.parsed||{}
            return(
              <div key={log.id} style={{display:'flex',gap:12,alignItems:'flex-start',paddingBottom:i<4?12:0,marginBottom:i<4?12:0,borderBottom:i<4?`1px solid ${CARD3}`:'none'}}>
                <span style={{fontSize:20,marginTop:1}}>{log.type==='food'?'🥗':log.type==='exercise'?'🏃':'⚖️'}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:TXT,fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.rawText}</div>
                  <div style={{color:TS,fontSize:11,marginTop:3}}>
                    {new Date(log.timestamp).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})} · {new Date(log.date+'T12:00:00').toLocaleDateString('en',{month:'short',day:'numeric'})}
                    {log.type==='food'&&` · ${Math.round(p.calories||0)} cal`}
                    {log.type==='exercise'&&` · ${p.duration||0}min`}
                    {log.type==='weight'&&` · ${p.weight}kg`}
                  </div>
                  {log.opinion&&<div style={{color:GRN,fontSize:11,marginTop:4,lineHeight:1.4,fontStyle:'italic'}}>💡 {log.opinion}</div>}
                </div>
              </div>
            )
          })}
        </Card>
      )}

      {/* Time picker modal */}
      {showTimePicker&&<TimePicker onConfirm={handleTimeConfirm} onCancel={()=>setShowTimePicker(false)}/>}
    </div>
  )
}

// ─── REPORTS VIEW ──────────────────────────────────────────────────
const ReportsView=({week,goals,latestWt})=>{
  const wL=week.filter(d=>d.calories>0)
  const wP=week.filter(d=>d.protein>0)
  const avgCals=wL.length?Math.round(wL.reduce((s,d)=>s+d.calories,0)/wL.length):0
  const avgProt=wP.length?Math.round(wP.reduce((s,d)=>s+d.protein,0)/wP.length):0
  return(
    <div style={{padding:'0 16px 100px'}}>
      <div style={{paddingTop:54,marginBottom:24}}>
        <div style={{color:TXT,fontSize:30,fontWeight:700}}>Reports</div>
        <div style={{color:TS,fontSize:14,marginTop:4}}>Weekly insights & trends</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        {[['🔥','Avg Calories',wL.length?avgCals:'—',wL.length?'kcal':'',RED],
          ['💪','Avg Protein',wP.length?avgProt:'—',wP.length?'g':'',PUR],
          ['📅','Days Logged',wL.length,'/ 7',GRN],
          ['⚖️','Weight',latestWt||'—',latestWt?'kg':'',BLU]].map(([ic,l,v,u,c])=>(
          <div key={l} style={{background:CARD,borderRadius:18,padding:16}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><span style={{fontSize:16}}>{ic}</span><span style={{color:TS,fontSize:12}}>{l}</span></div>
            <div style={{color:c,fontSize:26,fontWeight:700,lineHeight:1}}>{v}<span style={{fontSize:13,color:TS,fontWeight:400}}> {u}</span></div>
          </div>
        ))}
      </div>
      <Card>
        <CardHead t="Calories This Week" s={`Goal: ${goals.calories||2000} kcal/day`}/>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={week} barSize={28} margin={{top:4,right:4,left:-24,bottom:0}}>
            <XAxis dataKey="day" tick={{fill:TS,fontSize:12}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{background:CARD2,border:'none',borderRadius:12,color:TXT,fontSize:13}} cursor={{fill:CARD3}} formatter={v=>[`${v} kcal`,'Calories']}/>
            <Bar dataKey="calories" radius={[6,6,2,2]}>{week.map((d,i)=><Cell key={i} fill={d.isToday?RED:`${RED}55`}/>)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <CardHead t="Protein Trend" s={`Goal: ${goals.protein||60}g/day`}/>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={week} margin={{top:4,right:4,left:-24,bottom:0}}>
            <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={PUR} stopOpacity={.35}/><stop offset="100%" stopColor={PUR} stopOpacity={0}/></linearGradient></defs>
            <XAxis dataKey="day" tick={{fill:TS,fontSize:12}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{background:CARD2,border:'none',borderRadius:12,color:TXT,fontSize:13}} formatter={v=>[`${v}g`,'Protein']}/>
            <Area type="monotone" dataKey="protein" stroke={PUR} fill="url(#pg)" strokeWidth={2.5} dot={{fill:PUR,r:4}}/>
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <CardHead t="🌱 Vegetarian Nutrition Tips"/>
        {[['💪','Complete Protein Daily','Combine dal + rice or roti + dal for complete amino acids. Add paneer, tofu, or legumes daily.'],
          ['🩸','Boost Iron Absorption','Eat iron-rich foods (spinach, lentils) with Vitamin C (lemon, amla) — increases absorption by 3×.'],
          ['💊','B12 Alert','Nearly absent in plant foods. Take a B12 supplement and check blood levels every 6 months.'],
          ['☀️','Vitamin D','15–20 min morning sunlight daily. Fortified milk or sun-exposed mushrooms also help.'],
          ['🥜','Zinc Sources','Pumpkin seeds, cashews, chickpeas. Soak legumes to improve zinc absorption.']].map(([ic,t,d])=>(
          <div key={t} style={{display:'flex',gap:12,marginBottom:10,padding:14,background:CARD2,borderRadius:14}}>
            <span style={{fontSize:20,flexShrink:0}}>{ic}</span>
            <div><div style={{color:TXT,fontWeight:600,fontSize:14}}>{t}</div><div style={{color:TS,fontSize:12,marginTop:3,lineHeight:1.5}}>{d}</div></div>
          </div>
        ))}
      </Card>
    </div>
  )
}

// ─── PROFILE VIEW ──────────────────────────────────────────────────
const ProfileView=({profile,goals,onEdit,onClearLogs})=>(
  <div style={{padding:'0 16px 100px'}}>
    <div style={{paddingTop:54,marginBottom:24}}>
      <div style={{color:TXT,fontSize:30,fontWeight:700}}>Profile</div>
      <div style={{color:TS,fontSize:14,marginTop:4}}>Your personalized goals</div>
    </div>
    <Card>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:16}}>
        <div style={{width:56,height:56,borderRadius:28,background:`${GRN}22`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>{profile?.gender==='male'?'👨':'👩'}</div>
        <div>
          <div style={{color:TXT,fontSize:19,fontWeight:700}}>{profile?.name||'My Profile'}</div>
          <div style={{color:TS,fontSize:13,marginTop:2}}>{profile?.age} yrs · {profile?.weight}kg · {profile?.height}cm</div>
          <div style={{color:TS,fontSize:13}}>{ACT_LABELS[profile?.activity]} · {GOAL_LABELS[profile?.goal]}</div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
        {[['BMR',`${goals.bmr||0}`,TS],['TDEE',`${goals.tdee||0}`,GRN],['Target',`${goals.calories||0}`,RED]].map(([l,v,c])=>(
          <div key={l} style={{background:CARD2,borderRadius:12,padding:'10px 12px',textAlign:'center'}}>
            <div style={{color:TT,fontSize:10,fontWeight:700}}>{l}</div>
            <div style={{color:c,fontWeight:700,fontSize:17,marginTop:2}}>{v}</div>
            <div style={{color:TT,fontSize:10}}>kcal/d</div>
          </div>
        ))}
      </div>
      <button onClick={onEdit} style={{width:'100%',padding:12,background:CARD2,border:`1px solid ${CARD3}`,borderRadius:14,color:TS,fontWeight:600,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>✏️ Edit Profile & Recalculate Goals</button>
    </Card>
    <Card>
      <CardHead t="All 30 Daily Goals" s="Personalized for your age, gender & lifestyle"/>
      {['macro','vitamin','mineral'].map(cat=>(
        <div key={cat} style={{marginBottom:16}}>
          <div style={{color:TS,fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.8,marginBottom:8}}>{cat==='macro'?'Macronutrients':cat==='vitamin'?'Vitamins':'Minerals'}</div>
          {NUTR.filter(n=>n.cat===cat).map(n=>(
            <div key={n.k} style={{display:'flex',justifyContent:'space-between',padding:'7px 12px',background:CARD2,borderRadius:10,marginBottom:6}}>
              <span style={{color:TS,fontSize:13}}>{n.l}</span>
              <span style={{color:n.c,fontWeight:700,fontSize:13}}>{goals[n.k]||0}<span style={{color:TT,fontWeight:400,fontSize:11}}>{n.u}</span></span>
            </div>
          ))}
        </div>
      ))}
    </Card>
    <Card>
      <CardHead t="Data Management"/>
      <button onClick={onClearLogs} style={{width:'100%',padding:12,background:`${RED}15`,border:`1px solid ${RED}44`,borderRadius:14,color:RED,fontWeight:600,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>🗑️ Clear All Logs</button>
    </Card>
  </div>
)

// ─── SETUP SCREEN ──────────────────────────────────────────────────
const SetupScreen=({draft,setDraft,onSave,onCancel,hasProfile})=>{
  const bmi=(draft.weight/(draft.height/100)**2).toFixed(1)
  const bmiLabel=bmi<18.5?'Underweight':bmi<25?'Normal ✓':bmi<30?'Overweight':'Obese'
  const pg=calcGoals(draft)
  return(
    <div style={{background:BG,minHeight:'100dvh',maxWidth:430,margin:'0 auto',fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",sans-serif',color:TXT,overflowX:'hidden'}}>
      <div style={{height:'100dvh',overflowY:'auto',scrollbarWidth:'none',padding:'0 20px 40px'}}>
        <div style={{paddingTop:60,marginBottom:32,textAlign:'center'}}>
          <div style={{fontSize:52,marginBottom:12}}>🌿</div>
          <div style={{fontSize:28,fontWeight:700}}>Personalize your goals</div>
          <div style={{fontSize:15,color:TS,marginTop:6}}>We calculate your exact daily needs for all 30 nutrients</div>
        </div>
        <Card><CardHead t="What's your name?" s="Optional"/>
          <input value={draft.name} onChange={e=>setDraft(p=>({...p,name:e.target.value}))} placeholder="Your name"
            style={{width:'100%',background:CARD2,border:'none',borderRadius:12,padding:'12px 16px',color:TXT,fontSize:16,outline:'none',boxSizing:'border-box',caretColor:GRN}}/>
        </Card>
        <Card><CardHead t="Gender"/>
          <div style={{display:'flex',gap:10}}>
            {[['male','♂ Male'],['female','♀ Female']].map(([id,lb])=>(
              <button key={id} onClick={()=>setDraft(p=>({...p,gender:id}))}
                style={{flex:1,padding:14,borderRadius:14,border:`2px solid ${draft.gender===id?GRN:CARD3}`,background:draft.gender===id?`${GRN}18`:CARD2,color:draft.gender===id?GRN:TS,fontWeight:700,fontSize:15,cursor:'pointer',fontFamily:'inherit'}}>
                {lb}
              </button>
            ))}
          </div>
        </Card>
        <Card><CardHead t="Body Measurements"/>
          <Stepper label="Age" value={draft.age} onChange={v=>setDraft(p=>({...p,age:v}))} min={10} max={100} unit=" yrs"/>
          <Stepper label="Weight" value={draft.weight} onChange={v=>setDraft(p=>({...p,weight:v}))} min={30} max={200} unit=" kg"/>
          <Stepper label="Height" value={draft.height} onChange={v=>setDraft(p=>({...p,height:v}))} min={100} max={250} unit=" cm"/>
          <div style={{marginTop:8,padding:'10px 14px',background:CARD2,borderRadius:10}}>
            <span style={{color:TS,fontSize:12}}>BMI: </span><span style={{color:GRN,fontWeight:700}}>{bmi}</span>
            <span style={{color:TT,fontSize:12,marginLeft:8}}>{bmiLabel}</span>
          </div>
        </Card>
        <Card><CardHead t="Daily Activity Level"/>
          {[['sedentary','🛋️','Sedentary','Desk job, minimal exercise'],['light','🚶','Lightly Active','Light exercise 1–3 days/week'],
            ['moderate','🏊','Moderately Active','Moderate exercise 3–5 days/week'],['active','🏋️','Very Active','Hard exercise 6–7 days/week'],
            ['extra','⚡','Extra Active','Physical job + daily exercise']].map(([id,ic,lb,desc])=>(
            <button key={id} onClick={()=>setDraft(p=>({...p,activity:id}))}
              style={{display:'flex',alignItems:'center',gap:12,width:'100%',background:draft.activity===id?`${GRN}15`:CARD2,border:`1.5px solid ${draft.activity===id?GRN:CARD3}`,borderRadius:14,padding:'11px 14px',marginBottom:8,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
              <span style={{fontSize:22}}>{ic}</span>
              <div><div style={{color:draft.activity===id?GRN:TXT,fontWeight:600,fontSize:14}}>{lb}</div><div style={{color:TS,fontSize:11,marginTop:1}}>{desc}</div></div>
            </button>
          ))}
        </Card>
        <Card><CardHead t="Your Goal"/>
          <div style={{display:'flex',gap:10}}>
            {[['lose','📉','Lose Weight'],['maintain','⚖️','Maintain'],['gain','📈','Gain Muscle']].map(([id,ic,lb])=>(
              <button key={id} onClick={()=>setDraft(p=>({...p,goal:id}))}
                style={{flex:1,padding:'12px 6px',borderRadius:14,border:`2px solid ${draft.goal===id?GRN:CARD3}`,background:draft.goal===id?`${GRN}18`:CARD2,color:draft.goal===id?GRN:TS,fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit',textAlign:'center'}}>
                <div style={{fontSize:22,marginBottom:4}}>{ic}</div>{lb}
              </button>
            ))}
          </div>
        </Card>
        <Card><CardHead t="Your Personalized Daily Needs"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {[['BMR',`${pg.bmr} kcal`,TS],['TDEE',`${pg.tdee} kcal`,GRN],['Calorie Goal',`${pg.calories} kcal`,RED],['Protein',`${pg.protein}g`,PUR],
              ['Iron',`${pg.iron}mg`,RED],['Calcium',`${pg.calcium}mg`,CYN],['B12',`${pg.vitB12}mcg`,PUR],['Water',`${pg.water}ml`,BLU]].map(([l,v,c])=>(
              <div key={l} style={{background:CARD2,borderRadius:10,padding:'10px 12px'}}>
                <div style={{color:TS,fontSize:11}}>{l}</div>
                <div style={{color:c,fontWeight:700,fontSize:15,marginTop:2}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{color:TT,fontSize:11,textAlign:'center',marginTop:10}}>{ACT_LABELS[draft.activity]} · {GOAL_LABELS[draft.goal]}</div>
          <button onClick={onSave} style={{width:'100%',padding:16,background:GRN,border:'none',borderRadius:16,color:'#000',fontWeight:700,fontSize:17,cursor:'pointer',fontFamily:'inherit',marginTop:16}}>Start Tracking →</button>
          {hasProfile&&<button onClick={onCancel} style={{width:'100%',padding:12,background:'transparent',border:'none',borderRadius:16,color:TS,fontSize:14,cursor:'pointer',fontFamily:'inherit',marginTop:8}}>Cancel</button>}
        </Card>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN APP — only manages state, no UI components defined here
// ═══════════════════════════════════════════════════════════════════
export default function App(){
  const [tab,setTab]=useState('today')
  const [logs,setLogs]=useState([])
  const [profile,setProfile]=useState(null)
  const [goals,setGoals]=useState({})
  const [draft,setDraft]=useState({name:'',age:25,gender:'male',weight:70,height:170,activity:'moderate',goal:'maintain'})
  const [showSetup,setShowSetup]=useState(false)
  const [busy,setBusy]=useState(false)
  const [notif,setNotif]=useState(null)
  const [expandedId,setExpandedId]=useState(null)
  const [showAll,setShowAll]=useState(false)

  useEffect(()=>{
    const p=store.get('profile')
    const l=store.get('logs')
    if(p){setProfile(p);setGoals(calcGoals(p));setDraft(p)}
    else setShowSetup(true)
    if(l)setLogs(l)
  },[])

  const toast=useCallback((msg,err=false)=>{setNotif({msg,err});setTimeout(()=>setNotif(null),3000)},[])

  const saveProfile=useCallback(()=>{
    const g=calcGoals(draft)
    setProfile(draft);setGoals(g)
    store.set('profile',draft)
    setShowSetup(false)
    toast('Goals personalized! 🎯')
  },[draft,toast])

  const today=new Date().toISOString().split('T')[0]
  const fl=logs.filter(l=>l.date===today&&l.type==='food')
  const xl=logs.filter(l=>l.date===today&&l.type==='exercise')
  const tots=fl.reduce((a,l)=>NUTR.reduce((acc,n)=>({...acc,[n.k]:(acc[n.k]||0)+(l.parsed?.[n.k]||0)}),a),ZERO())
  const burned=xl.reduce((s,l)=>s+(l.parsed?.caloriesBurned||0),0)
  const latestWt=logs.find(l=>l.type==='weight')?.parsed?.weight

  const week=Array.from({length:7},(_,i)=>{
    const d=new Date();d.setDate(d.getDate()-(6-i))
    const ds=d.toISOString().split('T')[0]
    const df=logs.filter(l=>l.date===ds&&l.type==='food')
    return{day:d.toLocaleDateString('en',{weekday:'short'}),date:ds,isToday:ds===today,
      calories:Math.round(df.reduce((s,l)=>s+(l.parsed?.calories||0),0)),
      protein:Math.round(df.reduce((s,l)=>s+(l.parsed?.protein||0),0))}
  })

  // Main log handler — called from LogView with chosen time
  const handleLog=useCallback(async(inp,itype,chosenTime,clearInput)=>{
    if(busy)return
    setBusy(true)
    const profStr=profile?`${profile.age}yr ${profile.gender}, ${profile.weight}kg, ${profile.height}cm, ${ACT_LABELS[profile.activity]}, goal: ${GOAL_LABELS[profile.goal]}`:'unknown'
    try{
      let parsed
      if(itype==='food')         parsed=await parseFoodEntry(inp,profStr)
      else if(itype==='exercise')parsed=await parseExerciseEntry(inp)
      else                       parsed=await parseWeightEntry(inp)

      const entryId=Date.now()
      const entryDate=chosenTime.toISOString().split('T')[0]
      const entry={id:entryId,type:itype,rawText:inp,timestamp:chosenTime.toISOString(),date:entryDate,parsed,opinion:null,loadingOpinion:itype==='food'&&!!profile}
      const nl=[entry,...logs]
      setLogs(nl);store.set('logs',nl)
      clearInput()
      setBusy(false)
      const lbl=itype==='food'?(parsed.name||'Food'):itype==='exercise'?parsed.activity:`${parsed.weight} kg`
      toast(`✓ ${lbl} logged at ${chosenTime.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}!`)

      if(itype==='food'&&profile){
        const totsAfter=NUTR.reduce((a,n)=>({...a,[n.k]:(tots[n.k]||0)+(parsed[n.k]||0)}),{})
        try{
          const opinion=await getMealOpinion(parsed,profile,totsAfter,goals)
          setLogs(prev=>{
            const updated=prev.map(l=>l.id===entryId?{...l,opinion:opinion.trim(),loadingOpinion:false}:l)
            store.set('logs',updated);return updated
          })
        }catch{
          setLogs(prev=>prev.map(l=>l.id===entryId?{...l,loadingOpinion:false}:l))
        }
      }
    }catch(e){
      setBusy(false)
      const msg=e.message?.includes('API_KEY')?'⚠️ Add VITE_GEMINI_API_KEY in Vercel settings':
                e.message?.includes('JSON')?'Could not understand — please be more specific':
                'Error — check internet connection'
      toast(msg,true)
    }
  },[busy,logs,tots,goals,profile,toast])

  const clearLogs=useCallback(()=>{
    if(window.confirm('Delete all logs? Profile is kept.'))
      {store.remove('logs');setLogs([])}
  },[])

  const TABS=[['today','⚡','Today'],['log','➕','Log'],['reports','📊','Reports'],['profile','👤','Profile']]

  if(showSetup) return <SetupScreen draft={draft} setDraft={setDraft} onSave={saveProfile} onCancel={()=>setShowSetup(false)} hasProfile={!!profile}/>

  return(
    <div style={{background:BG,minHeight:'100dvh',maxWidth:430,margin:'0 auto',fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",sans-serif',color:TXT,position:'relative',overflowX:'hidden'}}>
      {notif&&(
        <div style={{position:'fixed',top:58,left:'50%',transform:'translateX(-50%)',background:notif.err?RED:GRN,color:'#000',padding:'10px 22px',borderRadius:22,fontWeight:700,fontSize:14,zIndex:400,whiteSpace:'nowrap',boxShadow:`0 4px 24px ${notif.err?RED:GRN}50`}}>
          {notif.msg}
        </div>
      )}
      <div style={{height:'100dvh',overflowY:'auto',scrollbarWidth:'none'}}>
        {tab==='today'&&<TodayView logs={logs} tots={tots} burned={burned} goals={goals} latestWt={latestWt} expandedId={expandedId} setExpandedId={setExpandedId} showAll={showAll} setShowAll={setShowAll} profile={profile}/>}
        {tab==='log'&&<LogView logs={logs} onLog={handleLog} busy={busy}/>}
        {tab==='reports'&&<ReportsView week={week} goals={goals} latestWt={latestWt}/>}
        {tab==='profile'&&<ProfileView profile={profile} goals={goals} onEdit={()=>setShowSetup(true)} onClearLogs={clearLogs}/>}
      </div>
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,background:'rgba(14,14,16,0.92)',backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)',borderTop:'0.5px solid rgba(255,255,255,0.1)',display:'flex',padding:'10px 0 22px',zIndex:100}}>
        {TABS.map(([id,ic,lb])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,background:'none',border:'none',cursor:'pointer',padding:0,fontFamily:'inherit',color:tab===id?GRN:TS,transition:'color .2s'}}>
            <span style={{fontSize:22,lineHeight:1}}>{ic}</span>
            <span style={{fontSize:10,fontWeight:tab===id?700:400}}>{lb}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
