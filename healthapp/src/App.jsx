import { useState, useEffect, useCallback, useRef } from 'react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts'
import { parseFoodEntry, parseExerciseEntry, parseWeightEntry, getMealOpinion, generateSmartTips } from './gemini'
import { store } from './storage'
import { NUTR, ZERO, calcGoals, getDeficiencies, FOOD_TIPS } from './goals'

// ── Palette ────────────────────────────────────────────────────────
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
  return`${parseFloat(v).toFixed(1)}${u}`
}

// ── Shared UI ──────────────────────────────────────────────────────
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
        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:3,transition:'width 0.5s ease'}}/>
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
const MicroTile=({n,value,goal,customGoal,onSetCustom})=>{
  const pct=goal>0?Math.min(((value||0)/goal)*100,100):0
  const isLow=pct<25
  const isDone=pct>=100
  return(
    <div style={{background:CARD2,borderRadius:14,padding:12,position:'relative'}}>
      {isLow&&(value||0)>0&&<span style={{position:'absolute',top:7,right:9,fontSize:10}}>⚠️</span>}
      {isDone&&<span style={{position:'absolute',top:7,right:9,fontSize:10}}>✅</span>}
      <div style={{color:TS,fontSize:11,marginBottom:4,paddingRight:18}}>{n.l}</div>
      <div style={{color:n.c,fontSize:17,fontWeight:700,lineHeight:1}}>{fmtN(value||0,n.u)}</div>
      <div style={{height:3,background:CARD3,borderRadius:2,marginTop:7,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:n.c,borderRadius:2}}/>
      </div>
      <div style={{color:TT,fontSize:10,marginTop:3}}>{Math.round(pct)}% of {goal}{n.u}</div>
    </div>
  )
}

// ── Water Tracker ──────────────────────────────────────────────────
const WaterTracker=({glasses,setGlasses})=>{
  const total=8
  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
        <span style={{color:TS,fontSize:13}}>Drinking Water</span>
        <span style={{color:BLU,fontWeight:700,fontSize:13}}>{glasses * 250}ml <span style={{color:TS,fontWeight:400}}>/ 2000ml</span></span>
      </div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {Array.from({length:total},(_,i)=>(
          <button key={i} onClick={()=>setGlasses(i<glasses?i:i+1)}
            style={{width:34,height:34,borderRadius:17,border:'none',cursor:'pointer',fontSize:16,
              background:i<glasses?`${BLU}22`:'transparent',
              color:i<glasses?BLU:CARD3,
              transition:'all .2s'}}>
            💧
          </button>
        ))}
      </div>
      <div style={{color:TT,fontSize:11,marginTop:6}}>Tap to add · Tap filled to remove · Each = 250ml</div>
    </div>
  )
}

// ── Clarification Modal ────────────────────────────────────────────
const ClarifyModal=({question,originalText,onAnswer,onCancel})=>{
  const [ans,setAns]=useState('')
  const ref=useRef(null)
  useEffect(()=>{setTimeout(()=>ref.current?.focus(),300)},[])
  return(
    <div style={{position:'fixed',inset:0,zIndex:500,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
      <div onClick={onCancel} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}}/>
      <div style={{position:'relative',background:CARD,borderRadius:'24px 24px 0 0',padding:'24px 20px 40px',zIndex:1}}>
        <div style={{width:36,height:4,background:CARD3,borderRadius:2,margin:'0 auto 20px'}}/>
        <div style={{fontSize:28,textAlign:'center',marginBottom:8}}>🤔</div>
        <div style={{color:TXT,fontSize:16,fontWeight:700,marginBottom:6,textAlign:'center'}}>Quick Clarification</div>
        <div style={{color:TS,fontSize:14,marginBottom:16,textAlign:'center',lineHeight:1.5}}>{question}</div>
        <div style={{background:CARD2,borderRadius:12,padding:'8px 14px',marginBottom:14}}>
          <div style={{color:TT,fontSize:11,marginBottom:2}}>Original entry:</div>
          <div style={{color:TS,fontSize:13}}>{originalText}</div>
        </div>
        <textarea ref={ref} value={ans} onChange={e=>setAns(e.target.value)} rows={2} placeholder="Type your answer here..."
          style={{width:'100%',background:CARD2,border:`1px solid ${CARD3}`,borderRadius:14,padding:'12px 14px',color:TXT,fontSize:16,resize:'none',fontFamily:'inherit',lineHeight:1.6,outline:'none',caretColor:GRN,boxSizing:'border-box',marginBottom:14}}/>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onCancel}
            style={{flex:1,padding:14,background:CARD2,border:'none',borderRadius:14,color:TS,fontWeight:600,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
            Skip / Log anyway
          </button>
          <button onClick={()=>ans.trim()&&onAnswer(`${originalText}, ${ans.trim()}`)}
            disabled={!ans.trim()}
            style={{flex:2,padding:14,background:ans.trim()?GRN:CARD3,border:'none',borderRadius:14,color:ans.trim()?'#000':TS,fontWeight:700,fontSize:14,cursor:ans.trim()?'pointer':'not-allowed',fontFamily:'inherit'}}>
            ✓ Confirm & Log
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Time Picker ────────────────────────────────────────────────────
const TimePicker=({onConfirm,onCancel})=>{
  const now=new Date()
  const pad=n=>String(n).padStart(2,'0')
  const [h,setH]=useState(now.getHours())
  const [m,setM]=useState(now.getMinutes())
  const [useNow,setUseNow]=useState(true)
  const confirm=()=>{
    if(useNow){onConfirm(new Date());return}
    const d=new Date();d.setHours(h,m,0,0);onConfirm(d)
  }
  return(
    <div style={{position:'fixed',inset:0,zIndex:500,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
      <div onClick={onCancel} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}}/>
      <div style={{position:'relative',background:CARD,borderRadius:'24px 24px 0 0',padding:'24px 20px 40px',zIndex:1}}>
        <div style={{width:36,height:4,background:CARD3,borderRadius:2,margin:'0 auto 20px'}}/>
        <div style={{color:TXT,fontSize:17,fontWeight:700,marginBottom:16,textAlign:'center'}}>When did you have this?</div>
        <div style={{display:'flex',background:CARD2,borderRadius:12,padding:4,marginBottom:20,gap:4}}>
          {[['now','⚡ Right Now'],['custom','🕐 Custom Time']].map(([id,lb])=>(
            <button key={id} onClick={()=>setUseNow(id==='now')}
              style={{flex:1,padding:'10px 4px',borderRadius:9,border:'none',cursor:'pointer',background:useNow===(id==='now')?CARD3:'transparent',color:useNow===(id==='now')?TXT:TS,fontWeight:useNow===(id==='now')?700:400,fontSize:14,fontFamily:'inherit'}}>
              {lb}
            </button>
          ))}
        </div>
        {useNow&&(
          <div style={{background:CARD2,borderRadius:14,padding:'16px 20px',textAlign:'center',marginBottom:20}}>
            <div style={{color:GRN,fontSize:36,fontWeight:700,letterSpacing:2}}>{pad(now.getHours())}:{pad(now.getMinutes())}</div>
            <div style={{color:TS,fontSize:12,marginTop:4}}>{now.toLocaleDateString('en',{weekday:'long',month:'short',day:'numeric'})}</div>
          </div>
        )}
        {!useNow&&(
          <div style={{background:CARD2,borderRadius:14,padding:'20px',marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:20}}>
              <div style={{textAlign:'center'}}>
                <button onClick={()=>setH(p=>(p+1)%24)} style={{display:'block',width:'100%',background:'none',border:'none',color:TS,fontSize:22,cursor:'pointer',padding:'4px 0'}}>▲</button>
                <div style={{color:TXT,fontSize:44,fontWeight:700,minWidth:70,textAlign:'center'}}>{pad(h)}</div>
                <button onClick={()=>setH(p=>(p-1+24)%24)} style={{display:'block',width:'100%',background:'none',border:'none',color:TS,fontSize:22,cursor:'pointer',padding:'4px 0'}}>▼</button>
                <div style={{color:TT,fontSize:11,marginTop:4}}>Hour</div>
              </div>
              <div style={{color:TXT,fontSize:40,fontWeight:300,marginBottom:10}}>:</div>
              <div style={{textAlign:'center'}}>
                <button onClick={()=>setM(p=>(p+5)%60)} style={{display:'block',width:'100%',background:'none',border:'none',color:TS,fontSize:22,cursor:'pointer',padding:'4px 0'}}>▲</button>
                <div style={{color:TXT,fontSize:44,fontWeight:700,minWidth:70,textAlign:'center'}}>{pad(m)}</div>
                <button onClick={()=>setM(p=>(p-5+60)%60)} style={{display:'block',width:'100%',background:'none',border:'none',color:TS,fontSize:22,cursor:'pointer',padding:'4px 0'}}>▼</button>
                <div style={{color:TT,fontSize:11,marginTop:4}}>Min</div>
              </div>
              <div style={{textAlign:'center',marginBottom:10}}>
                <div style={{color:GRN,fontSize:15,fontWeight:700}}>{h<12?'AM':'PM'}</div>
              </div>
            </div>
          </div>
        )}
        <button onClick={confirm} style={{width:'100%',padding:16,background:GRN,border:'none',borderRadius:16,color:'#000',fontWeight:700,fontSize:16,cursor:'pointer',fontFamily:'inherit'}}>Confirm Time →</button>
      </div>
    </div>
  )
}

// ── Edit Modal ─────────────────────────────────────────────────────
const EditModal=({entry,onSave,onDelete,onCancel})=>{
  const [text,setText]=useState(entry.rawText)
  const p=entry.parsed||{}
  return(
    <div style={{position:'fixed',inset:0,zIndex:500,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
      <div onClick={onCancel} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}}/>
      <div style={{position:'relative',background:CARD,borderRadius:'24px 24px 0 0',padding:'24px 20px 40px',zIndex:1}}>
        <div style={{width:36,height:4,background:CARD3,borderRadius:2,margin:'0 auto 20px'}}/>
        <div style={{color:TXT,fontSize:17,fontWeight:700,marginBottom:4}}>Edit Log Entry</div>
        <div style={{color:TS,fontSize:12,marginBottom:16}}>
          {new Date(entry.timestamp).toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric'})} · {new Date(entry.timestamp).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}
        </div>
        {entry.type==='food'&&(
          <div style={{background:CARD2,borderRadius:12,padding:'10px 14px',marginBottom:14}}>
            <div style={{color:TS,fontSize:11,marginBottom:4}}>Currently logged as:</div>
            <div style={{color:TXT,fontSize:14,fontWeight:600}}>{p.name}</div>
            <div style={{color:TS,fontSize:12,marginTop:2}}>
              {Math.round(p.calories||0)} cal · {Math.round(p.protein||0)}g protein · {(p.iron||0).toFixed(1)}mg iron · {Math.round(p.calcium||0)}mg calcium
            </div>
          </div>
        )}
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={3}
          style={{width:'100%',background:CARD2,border:`1px solid ${CARD3}`,borderRadius:14,padding:'12px 14px',color:TXT,fontSize:16,resize:'none',fontFamily:'inherit',lineHeight:1.6,outline:'none',caretColor:GRN,boxSizing:'border-box',marginBottom:14}}/>
        <div style={{display:'flex',gap:10}}>
          <button onClick={()=>onDelete(entry.id)}
            style={{flex:1,padding:14,background:`${RED}18`,border:`1px solid ${RED}44`,borderRadius:14,color:RED,fontWeight:700,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
            🗑️ Delete
          </button>
          <button onClick={()=>onSave(entry.id,text)}
            style={{flex:2,padding:14,background:GRN,border:'none',borderRadius:14,color:'#000',fontWeight:700,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
            ✓ Re-analyze & Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Smart Tips ─────────────────────────────────────────────────────
const SmartTipsPanel=({deficiencies,aiTips,loadingTips})=>{
  if(deficiencies.length===0) return(
    <div style={{textAlign:'center',padding:'12px 0'}}>
      <div style={{fontSize:36,marginBottom:8}}>🎉</div>
      <div style={{color:GRN,fontWeight:600,fontSize:14}}>Great job! All nutrients on track today</div>
    </div>
  )
  const tips=aiTips||deficiencies.slice(0,3).map(d=>({
    nutrient:d.l,
    tip:FOOD_TIPS[d.k]?.tip||`Increase ${d.l} intake`,
    food:FOOD_TIPS[d.k]?.foods||'See nutrition guide',
    urgency:d.pct<20?'high':d.pct<40?'medium':'low',
    emoji:FOOD_TIPS[d.k]?.emoji||'💊',
    pct:d.pct,
    value:d.value,
    goal:d.goal,
    unit:d.u,
  }))
  return(
    <div>
      {loadingTips&&<div style={{color:TT,fontSize:12,marginBottom:10}}>🤖 Generating personalized tips...</div>}
      {tips.map((tip,i)=>{
        const urgencyColor=tip.urgency==='high'?RED:tip.urgency==='medium'?ORG:YEL
        const def=deficiencies.find(d=>d.l===tip.nutrient||d.k===tip.nutrient?.toLowerCase())
        const pct=def?.pct||tip.pct||0
        return(
          <div key={i} style={{display:'flex',gap:12,marginBottom:i<tips.length-1?12:0,padding:14,background:CARD2,borderRadius:14,border:`1px solid ${urgencyColor}22`}}>
            <div style={{flexShrink:0}}>
              <div style={{width:44,height:44,borderRadius:22,background:`${urgencyColor}18`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                <div style={{fontSize:14}}>{tip.emoji||FOOD_TIPS[tip.nutrient?.toLowerCase()]?.emoji||'💊'}</div>
                <div style={{color:urgencyColor,fontSize:10,fontWeight:700}}>{pct}%</div>
              </div>
            </div>
            <div style={{flex:1}}>
              <div style={{color:urgencyColor,fontWeight:700,fontSize:13,marginBottom:3}}>{tip.nutrient} — {pct<20?'Critical':'Low'}</div>
              <div style={{color:TS,fontSize:12,lineHeight:1.5,marginBottom:4}}>💡 {tip.tip}</div>
              <div style={{color:TT,fontSize:11}}>🥗 Eat now: {tip.food}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Custom Goals Modal ─────────────────────────────────────────────
const CustomGoalsModal=({goals,onSave,onCancel})=>{
  const [custom,setCustom]=useState({})
  const keyNutrs=['calories','protein','carbs','fat','fiber','iron','calcium','vitB12','zinc','vitD','vitC']
  const filtered=NUTR.filter(n=>keyNutrs.includes(n.k))
  return(
    <div style={{position:'fixed',inset:0,zIndex:500,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
      <div onClick={onCancel} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}}/>
      <div style={{position:'relative',background:CARD,borderRadius:'24px 24px 0 0',padding:'24px 20px 0',zIndex:1,maxHeight:'80dvh',display:'flex',flexDirection:'column'}}>
        <div style={{width:36,height:4,background:CARD3,borderRadius:2,margin:'0 auto 20px'}}/>
        <div style={{color:TXT,fontSize:17,fontWeight:700,marginBottom:4}}>Custom Goals</div>
        <div style={{color:TS,fontSize:12,marginBottom:16}}>Leave blank to use calculated value</div>
        <div style={{overflowY:'auto',flex:1,paddingBottom:20}}>
          {filtered.map(n=>(
            <div key={n.k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div>
                <div style={{color:TXT,fontSize:14}}>{n.l}</div>
                <div style={{color:TT,fontSize:11}}>Calculated: {goals[n.k]}{n.u}</div>
              </div>
              <input type="number" value={custom[n.k]||''} onChange={e=>setCustom(p=>({...p,[n.k]:e.target.value?+e.target.value:undefined}))}
                placeholder={`${goals[n.k]}`}
                style={{width:90,background:CARD2,border:`1px solid ${custom[n.k]?n.c:CARD3}`,borderRadius:10,padding:'8px 10px',color:custom[n.k]?n.c:TS,fontSize:14,outline:'none',textAlign:'right',fontFamily:'inherit'}}/>
            </div>
          ))}
        </div>
        <div style={{padding:'16px 0 40px',borderTop:`1px solid ${CARD3}`,display:'flex',gap:10}}>
          <button onClick={onCancel} style={{flex:1,padding:14,background:CARD2,border:'none',borderRadius:14,color:TS,fontWeight:600,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
          <button onClick={()=>onSave(Object.fromEntries(Object.entries(custom).filter(([,v])=>v)))}
            style={{flex:2,padding:14,background:GRN,border:'none',borderRadius:14,color:'#000',fontWeight:700,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
            ✓ Save Custom Goals
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Entry Card ─────────────────────────────────────────────────────
const EntryCard=({entry,goals,expanded,onToggle,onEdit})=>{
  const p=entry.parsed||{}
  const conf={
    food:{icon:'🥗',color:RED,summary:`${Math.round(p.calories||0)} cal · ${Math.round(p.protein||0)}g protein`},
    exercise:{icon:'🏃',color:GRN,summary:`${p.duration||0} min · ${p.caloriesBurned||0} cal burned`},
    weight:{icon:'⚖️',color:BLU,summary:`${parseFloat(p.weight||0).toFixed(2)} kg`},
  }[entry.type]||{icon:'📝',color:TS,summary:''}
  const topNutrs=entry.type==='food'
    ?NUTR.filter(n=>n.cat!=='macro'&&(p[n.k]||0)>0&&goals[n.k]>0)
        .sort((a,b)=>((p[b.k]||0)/goals[b.k])-((p[a.k]||0)/goals[a.k])).slice(0,5)
    :[]
  return(
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
        <div onClick={entry.type==='food'?onToggle:undefined}
          style={{width:38,height:38,borderRadius:11,background:`${conf.color}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,cursor:entry.type==='food'?'pointer':'default'}}>
          {conf.icon}
        </div>
        <div style={{flex:1}} onClick={entry.type==='food'?onToggle:undefined}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div style={{color:TXT,fontWeight:600,fontSize:14,flex:1,paddingRight:8,cursor:entry.type==='food'?'pointer':'default'}}>
              {p.name||p.activity||`Weight: ${parseFloat(p.weight||0).toFixed(2)}kg`}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
              <div style={{color:TT,fontSize:11}}>{new Date(entry.timestamp).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}</div>
              <button onClick={e=>{e.stopPropagation();onEdit(entry)}}
                style={{background:CARD2,border:'none',borderRadius:8,padding:'3px 8px',color:TS,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>✏️</button>
            </div>
          </div>
          <div style={{color:TS,fontSize:12,marginTop:2}}>{conf.summary}</div>
          {entry.loadingOpinion&&<div style={{color:TT,fontSize:12,marginTop:6}}>⏳ Analyzing nutrition...</div>}
          {entry.opinion&&<div style={{color:GRN,fontSize:12,marginTop:6,lineHeight:1.5,fontStyle:'italic'}}>💡 {entry.opinion}</div>}
          {topNutrs.length>0&&(
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:8}}>
              {topNutrs.map(n=>(
                <span key={n.k} style={{background:`${n.c}20`,color:n.c,fontSize:10,fontWeight:600,padding:'3px 8px',borderRadius:20}}>
                  +{fmtN(p[n.k],n.u)} {n.l.split(' ').slice(-1)[0]}
                </span>
              ))}
              <span style={{background:CARD3,color:TS,fontSize:10,padding:'3px 8px',borderRadius:20}}>
                {expanded?'▲ less':'▼ full breakdown'}
              </span>
            </div>
          )}
        </div>
      </div>
      {expanded&&entry.type==='food'&&(
        <div style={{marginTop:12,marginLeft:50}}>
          <div style={{color:TT,fontSize:11,fontWeight:700,letterSpacing:.8,textTransform:'uppercase',marginBottom:8}}>Full Nutrient Breakdown</div>
          {['macro','vitamin','mineral'].map(cat=>(
            <div key={cat} style={{marginBottom:12}}>
              <div style={{color:TS,fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:.6,marginBottom:6}}>
                {cat==='macro'?'Macros':cat==='vitamin'?'Vitamins':'Minerals'}
              </div>
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

// ── Rings ──────────────────────────────────────────────────────────
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
          const circ=2*Math.PI*r.r
          const pct=Math.min(Math.max((r.v||0)/r.max,0),1)
          return(<g key={i}>
            <circle cx={100} cy={100} r={r.r} fill="none" stroke={`${r.color}22`} strokeWidth={16}/>
            {(r.v||0)>0&&<circle cx={100} cy={100} r={r.r} fill="none" stroke={r.color} strokeWidth={16}
              strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} strokeLinecap="round"/>}
          </g>)
        })}
      </svg>
      <div>{rs.map((r,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:i<2?16:0}}>
          <div style={{width:10,height:10,borderRadius:'50%',background:r.color,flexShrink:0}}/>
          <div>
            <div style={{color:r.color,fontSize:21,fontWeight:700,lineHeight:1.1}}>
              {Math.round(r.v||0)}<span style={{fontSize:11,color:TS,fontWeight:400}}> {r.unit}</span>
            </div>
            <div style={{color:TS,fontSize:10,fontWeight:600,letterSpacing:.7,marginTop:2}}>{r.label}</div>
          </div>
        </div>
      ))}</div>
    </div>
  )
}

// ── TODAY VIEW ─────────────────────────────────────────────────────
const TodayView=({logs,tots,burned,goals,latestWt,expandedId,setExpandedId,showAll,setShowAll,profile,onEdit,glasses,setGlasses,aiTips,loadingTips})=>{
  const today=new Date().toISOString().split('T')[0]
  const tl=[...logs.filter(l=>l.date===today)].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))
  const vitamins=NUTR.filter(n=>n.cat==='vitamin')
  const minerals=NUTR.filter(n=>n.cat==='mineral')
  const hour=new Date().getHours()
  const greet=hour<12?'Good morning ☀️':hour<17?'Good afternoon 🌤️':'Good evening 🌙'
  const deficiencies=getDeficiencies(tots,goals)

  return(
    <div style={{padding:'0 16px 100px'}}>
      <div style={{paddingTop:54,marginBottom:24}}>
        <div style={{color:TS,fontSize:12,fontWeight:600,letterSpacing:1.2,textTransform:'uppercase'}}>
          {new Date().toLocaleDateString('en',{weekday:'long',month:'long',day:'numeric'})}
        </div>
        <div style={{color:TXT,fontSize:28,fontWeight:700,marginTop:4}}>
          {greet}{profile?.name?`, ${profile.name.split(' ')[0]}`:''} 
        </div>
      </div>

      {/* Rings */}
      <Card>
        <CardHead t="Activity Rings" s="Move · Exercise · Protein"/>
        <Rings tots={tots} burned={burned} goals={goals}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8,marginTop:16}}>
          {[['GOAL',goals.calories||'—',TS],['EATEN',Math.round(tots.calories),RED],
            ['BURNED',Math.round(burned),GRN],['LEFT',Math.max(0,Math.round((goals.calories||2000)-tots.calories+burned)),BLU]].map(([l,v,c])=>(
            <div key={l} style={{background:CARD2,borderRadius:10,padding:'9px 4px',textAlign:'center'}}>
              <div style={{color:TT,fontSize:9,fontWeight:700,letterSpacing:.5,marginBottom:3}}>{l}</div>
              <div style={{color:c,fontSize:18,fontWeight:700}}>{v}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Water tracker */}
      <Card>
        <CardHead t="💧 Drinking Water" s="Track glasses separately from food water"/>
        <WaterTracker glasses={glasses} setGlasses={setGlasses}/>
        {glasses>=8&&<div style={{color:GRN,fontSize:12,marginTop:8,fontWeight:600}}>✅ Daily water goal reached! Great job!</div>}
      </Card>

      {/* Smart tips — AI or fallback */}
      <Card>
        <CardHead t="🎯 Priority Tips" s={deficiencies.length>0?`${deficiencies.length} nutrients need attention · Based on today's intake`:'All good today'}/>
        <SmartTipsPanel deficiencies={deficiencies} aiTips={aiTips} loadingTips={loadingTips}/>
      </Card>

      {/* Macros */}
      <Card>
        <CardHead t="Macronutrients"/>
        {NUTR.filter(n=>n.cat==='macro').map(n=><PBar key={n.k} label={n.l} value={tots[n.k]} max={goals[n.k]||1} color={n.c} unit={n.u}/>)}
      </Card>

      {/* Vitamins */}
      <Card>
        <CardHead t="Vitamins" s={`ICMR-NIN 2020 · Vegetarian-adjusted · ${profile?.age}yr ${profile?.gender||''}`}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {(showAll?vitamins:vitamins.slice(0,6)).map(n=><MicroTile key={n.k} n={n} value={tots[n.k]} goal={goals[n.k]||1}/>)}
        </div>
        <button onClick={()=>setShowAll(!showAll)} style={{width:'100%',marginTop:10,padding:8,background:CARD2,border:'none',borderRadius:10,color:TS,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
          {showAll?'▲ Show Less':'▼ Show All Vitamins'}
        </button>
      </Card>

      {/* Minerals */}
      <Card>
        <CardHead t="Minerals" s="Plant absorption factors applied"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {(showAll?minerals:minerals.slice(0,6)).map(n=><MicroTile key={n.k} n={n} value={tots[n.k]} goal={goals[n.k]||1}/>)}
        </div>
        <button onClick={()=>setShowAll(!showAll)} style={{width:'100%',marginTop:10,padding:8,background:CARD2,border:'none',borderRadius:10,color:TS,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
          {showAll?'▲ Show Less':'▼ Show All Minerals'}
        </button>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHead t="Today's Timeline" s="Most recent first · ✏️ to edit or delete"/>
        {tl.length===0?(
          <div style={{textAlign:'center',padding:'16px 0'}}>
            <div style={{fontSize:44,marginBottom:10}}>🌱</div>
            <div style={{color:TS,fontSize:14}}>Start logging your first meal!</div>
          </div>
        ):tl.map((item,i,arr)=>(
          <div key={item.id}>
            <EntryCard entry={item} goals={goals} expanded={expandedId===item.id}
              onToggle={()=>setExpandedId(expandedId===item.id?null:item.id)} onEdit={onEdit}/>
            {i<arr.length-1&&<div style={{height:1,background:CARD3,margin:'4px 0 12px 50px'}}/>}
          </div>
        ))}
      </Card>

      {latestWt&&(
        <Card>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{color:TXT,fontSize:15,fontWeight:700}}>Current Weight</div>
              <div style={{color:TS,fontSize:12,marginTop:2}}>Last recorded</div>
            </div>
            <div>
              <span style={{color:BLU,fontSize:44,fontWeight:700}}>{parseFloat(latestWt).toFixed(2)}</span>
              <span style={{color:TS,fontSize:22}}> kg</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

// ── LOG VIEW ───────────────────────────────────────────────────────
const LOG_EX={
  food:['Had poha and masala chai for breakfast','Dal rice sabzi with 2 roti for lunch','Evening snack: 20g almonds and one banana','Dinner: palak paneer, 2 chapati, bowl of curd','200ml full fat milk'],
  exercise:['30 minute morning yoga session','Jogged 5km in about 35 minutes','45 min strength training at gym','20-minute brisk evening walk'],
  weight:['My weight this morning is 70.50 kg','Weighed 68.25 kg today','Evening weight: 71.00 kg'],
}

const LogView=({logs,onLog,busy})=>{
  const [inp,setInp]=useState('')
  const [itype,setItype]=useState('food')
  const [showTimePicker,setShowTimePicker]=useState(false)
  const [pendingTime,setPendingTime]=useState(null)
  const [clarify,setClarify]=useState(null)
  const taRef=useRef(null)
  const recentLogs=[...logs].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))

  const handleLogPress=()=>{
    if(!inp.trim()||busy)return
    taRef.current?.blur()
    setTimeout(()=>setShowTimePicker(true),100)
  }
  const handleTimeConfirm=(t)=>{setShowTimePicker(false);setPendingTime(t);onLog(inp,itype,t,()=>setInp(''),setClarify)}
  const handleClarifyAnswer=(newText)=>{setClarify(null);onLog(newText,itype,pendingTime||new Date(),()=>setInp(''),null)}

  return(
    <div style={{padding:'0 16px 100px'}}>
      <div style={{paddingTop:54,marginBottom:24}}>
        <div style={{color:TXT,fontSize:30,fontWeight:700}}>Log</div>
        <div style={{color:TS,fontSize:14,marginTop:4}}>Tell me what you ate, did, or weigh</div>
      </div>

      <div style={{display:'flex',background:CARD2,borderRadius:12,padding:4,marginBottom:16,gap:4}}>
        {[['food','🥗','Food'],['exercise','🏃','Exercise'],['weight','⚖️','Weight']].map(([id,ic,lb])=>(
          <button key={id} onClick={()=>setItype(id)}
            style={{flex:1,padding:'9px 4px',borderRadius:9,border:'none',cursor:'pointer',background:itype===id?CARD3:'transparent',color:itype===id?TXT:TS,fontWeight:itype===id?700:400,fontSize:13,fontFamily:'inherit',transition:'all .2s'}}>
            {ic} {lb}
          </button>
        ))}
      </div>

      <Card>
        <textarea ref={taRef} value={inp} onChange={e=>setInp(e.target.value)} rows={4}
          placeholder={{
            food:'"Had 2 chapati with dal makhani and lassi for lunch"',
            exercise:'"Did 30 min morning yoga"',
            weight:'"My weight is 72.50 kg"'
          }[itype]}
          style={{width:'100%',background:'transparent',border:'none',outline:'none',color:TXT,fontSize:16,resize:'none',fontFamily:'inherit',lineHeight:1.6,boxSizing:'border-box',caretColor:GRN}}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12,paddingTop:12,borderTop:`1px solid ${CARD3}`}}>
          <div style={{color:TS,fontSize:12}}>
            {itype==='food'?'🤖 AI analyzes 30 nutrients + may ask clarification':itype==='weight'?'⚖️ Format: 00.00 kg':'🤖 AI calculates calories burned'}
          </div>
          <button onClick={handleLogPress} disabled={busy||!inp.trim()}
            style={{background:busy||!inp.trim()?CARD3:GRN,color:busy||!inp.trim()?TS:'#000',border:'none',borderRadius:20,padding:'9px 22px',fontWeight:700,fontSize:14,cursor:busy||!inp.trim()?'not-allowed':'pointer',fontFamily:'inherit',transition:'all .2s'}}>
            {busy?'⏳ Analyzing…':'Log It →'}
          </button>
        </div>
      </Card>

      <Card>
        <div style={{color:TS,fontSize:11,fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:12}}>Try These</div>
        {LOG_EX[itype].map((ex,i)=>(
          <button key={i} onClick={()=>setInp(ex)}
            style={{display:'block',width:'100%',textAlign:'left',background:CARD2,border:'none',borderRadius:12,padding:'11px 14px',marginBottom:i<LOG_EX[itype].length-1?8:0,color:TS,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
            <span style={{color:TT,marginRight:8}}>›</span>{ex}
          </button>
        ))}
      </Card>

      {recentLogs.length>0&&(
        <Card>
          <div style={{color:TS,fontSize:11,fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:12}}>Recent — Most Recent First</div>
          {recentLogs.slice(0,6).map((log,i)=>{
            const p=log.parsed||{}
            return(
              <div key={log.id} style={{display:'flex',gap:12,alignItems:'flex-start',paddingBottom:i<5?12:0,marginBottom:i<5?12:0,borderBottom:i<5?`1px solid ${CARD3}`:'none'}}>
                <span style={{fontSize:20,marginTop:1}}>{log.type==='food'?'🥗':log.type==='exercise'?'🏃':'⚖️'}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:TXT,fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.rawText}</div>
                  <div style={{color:TS,fontSize:11,marginTop:3}}>
                    {new Date(log.timestamp).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})} · {new Date(log.date+'T12:00:00').toLocaleDateString('en',{month:'short',day:'numeric'})}
                    {log.type==='food'&&` · ${Math.round(p.calories||0)} cal · ${Math.round(p.protein||0)}g prot · ${(p.iron||0).toFixed(1)}mg iron`}
                    {log.type==='exercise'&&` · ${p.duration||0}min · −${p.caloriesBurned||0}cal`}
                    {log.type==='weight'&&` · ${parseFloat(p.weight||0).toFixed(2)} kg`}
                  </div>
                  {log.opinion&&<div style={{color:GRN,fontSize:11,marginTop:3,lineHeight:1.4,fontStyle:'italic'}}>💡 {log.opinion}</div>}
                </div>
              </div>
            )
          })}
        </Card>
      )}

      {showTimePicker&&<TimePicker onConfirm={handleTimeConfirm} onCancel={()=>setShowTimePicker(false)}/>}
      {clarify&&<ClarifyModal question={clarify.question} originalText={clarify.originalText} onAnswer={handleClarifyAnswer} onCancel={()=>{setClarify(null);onLog(clarify.originalText,'food',pendingTime||new Date(),()=>setInp(''),null)}}/>}
    </div>
  )
}

// ── REPORTS VIEW ───────────────────────────────────────────────────
const ReportsView=({week,goals,latestWt,logs})=>{
  const wL=week.filter(d=>d.calories>0)
  const wP=week.filter(d=>d.protein>0)
  const avgCals=wL.length?Math.round(wL.reduce((s,d)=>s+d.calories,0)/wL.length):0
  const avgProt=wP.length?Math.round(wP.reduce((s,d)=>s+d.protein,0)/wP.length):0
  const wtLogs=[...logs.filter(l=>l.type==='weight')].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,7)

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
          ['⚖️','Weight',latestWt?parseFloat(latestWt).toFixed(2):'—',latestWt?'kg':'',BLU]].map(([ic,l,v,u,c])=>(
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
      {wtLogs.length>0&&(
        <Card>
          <CardHead t="⚖️ Weight History" s="Most recent first"/>
          {wtLogs.map((log,i)=>(
            <div key={log.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<wtLogs.length-1?`1px solid ${CARD3}`:'none'}}>
              <div style={{color:TS,fontSize:13}}>{new Date(log.date+'T12:00:00').toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric'})}</div>
              <div style={{color:BLU,fontWeight:700,fontSize:18}}>{parseFloat(log.parsed?.weight||0).toFixed(2)}<span style={{color:TS,fontWeight:400,fontSize:13}}> kg</span></div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

// ── PROFILE VIEW ───────────────────────────────────────────────────
const ProfileView=({profile,goals,customGoals,onEdit,onClearLogs,onSetCustomGoals})=>{
  const [showCustom,setShowCustom]=useState(false)
  return(
    <div style={{padding:'0 16px 100px'}}>
      <div style={{paddingTop:54,marginBottom:24}}>
        <div style={{color:TXT,fontSize:30,fontWeight:700}}>Profile</div>
        <div style={{color:TS,fontSize:14,marginTop:4}}>Your personalized goals · ICMR-NIN 2020</div>
      </div>
      <Card>
        <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:16}}>
          <div style={{width:56,height:56,borderRadius:28,background:`${GRN}22`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>
            {profile?.gender==='male'?'👨':'👩'}
          </div>
          <div>
            <div style={{color:TXT,fontSize:19,fontWeight:700}}>{profile?.name||'My Profile'}</div>
            <div style={{color:TS,fontSize:13,marginTop:2}}>{profile?.age} yrs · {profile?.weight}kg · {profile?.height}cm</div>
            <div style={{color:TS,fontSize:13}}>{ACT_LABELS[profile?.activity]} · {GOAL_LABELS[profile?.goal]}</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
          {[['BMR',`${goals.bmr||0}`,TS,'Base rate'],['TDEE',`${goals.tdee||0}`,GRN,'With activity'],['Target',`${goals.calories||0}`,RED,'Your goal']].map(([l,v,c,d])=>(
            <div key={l} style={{background:CARD2,borderRadius:12,padding:'10px 12px',textAlign:'center'}}>
              <div style={{color:TT,fontSize:10,fontWeight:700}}>{l}</div>
              <div style={{color:c,fontWeight:700,fontSize:17,marginTop:2}}>{v}</div>
              <div style={{color:TT,fontSize:10}}>{d} kcal/d</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onEdit} style={{flex:1,padding:12,background:CARD2,border:`1px solid ${CARD3}`,borderRadius:14,color:TS,fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>✏️ Edit Profile</button>
          <button onClick={()=>setShowCustom(true)} style={{flex:1,padding:12,background:`${PUR}18`,border:`1px solid ${PUR}44`,borderRadius:14,color:PUR,fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>🎯 Custom Goals</button>
        </div>
        {Object.keys(customGoals||{}).length>0&&(
          <div style={{marginTop:10,padding:'8px 12px',background:`${GRN}15`,borderRadius:10}}>
            <div style={{color:GRN,fontSize:12,fontWeight:600}}>✅ {Object.keys(customGoals).length} custom goal(s) active</div>
            <button onClick={()=>onSetCustomGoals({})} style={{color:TS,fontSize:11,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',marginTop:2}}>Reset to calculated →</button>
          </div>
        )}
      </Card>
      <Card>
        <CardHead t="All 30 Daily Goals" s="Research-based · Vegetarian India adjustments applied"/>
        {['macro','vitamin','mineral'].map(cat=>(
          <div key={cat} style={{marginBottom:16}}>
            <div style={{color:TS,fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.8,marginBottom:8}}>
              {cat==='macro'?'Macronutrients':cat==='vitamin'?'Vitamins':'Minerals'}
            </div>
            {NUTR.filter(n=>n.cat===cat).map(n=>(
              <div key={n.k} style={{display:'flex',justifyContent:'space-between',padding:'7px 12px',background:customGoals?.[n.k]?`${n.c}10`:CARD2,borderRadius:10,marginBottom:6,border:`1px solid ${customGoals?.[n.k]?n.c+'44':'transparent'}`}}>
                <span style={{color:TS,fontSize:13}}>{n.l}</span>
                <span style={{color:customGoals?.[n.k]?n.c:TXT,fontWeight:700,fontSize:13}}>
                  {goals[n.k]||0}<span style={{color:TT,fontWeight:400,fontSize:11}}>{n.u}</span>
                  {customGoals?.[n.k]&&<span style={{color:n.c,fontSize:10}}> ✏️</span>}
                </span>
              </div>
            ))}
          </div>
        ))}
      </Card>
      <Card>
        <CardHead t="Data Management"/>
        <button onClick={onClearLogs} style={{width:'100%',padding:12,background:`${RED}15`,border:`1px solid ${RED}44`,borderRadius:14,color:RED,fontWeight:600,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
          🗑️ Clear All Logs
        </button>
      </Card>
      {showCustom&&<CustomGoalsModal goals={goals} onSave={g=>{onSetCustomGoals(g);setShowCustom(false)}} onCancel={()=>setShowCustom(false)}/>}
    </div>
  )
}

// ── SETUP SCREEN ───────────────────────────────────────────────────
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
          <div style={{fontSize:15,color:TS,marginTop:6}}>ICMR-NIN 2020 · India-specific nutrition science</div>
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
          <Stepper label="Weight" value={draft.weight} onChange={v=>setDraft(p=>({...p,weight:v}))} min={30} max={200} step={0.5} unit=" kg"/>
          <Stepper label="Height" value={draft.height} onChange={v=>setDraft(p=>({...p,height:v}))} min={100} max={250} unit=" cm"/>
          <div style={{marginTop:8,padding:'10px 14px',background:CARD2,borderRadius:10}}>
            <span style={{color:TS,fontSize:12}}>BMI: </span><span style={{color:GRN,fontWeight:700}}>{bmi}</span>
            <span style={{color:TT,fontSize:12,marginLeft:8}}>{bmiLabel}</span>
          </div>
        </Card>
        <Card><CardHead t="Daily Activity Level"/>
          {[['sedentary','🛋️','Sedentary','Desk job, no exercise'],
            ['light','🚶','Lightly Active','Exercise 1-3 days/week'],
            ['moderate','🏊','Moderately Active','Exercise 3-5 days/week'],
            ['active','🏋️','Very Active','Hard exercise 6-7 days/week'],
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
        <Card><CardHead t="Your Research-Based Daily Needs"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {[['BMR',`${pg.bmr} kcal`,TS],['TDEE',`${pg.tdee} kcal`,GRN],
              ['Calorie Goal',`${pg.calories} kcal`,RED],['Protein',`${pg.protein}g`,PUR],
              ['Iron',`${pg.iron}mg`,RED],['Calcium',`${pg.calcium}mg`,CYN],
              ['B12',`${pg.vitB12}mcg`,PUR],['Zinc',`${pg.zinc}mg`,BLU]].map(([l,v,c])=>(
              <div key={l} style={{background:CARD2,borderRadius:10,padding:'10px 12px'}}>
                <div style={{color:TS,fontSize:11}}>{l}</div>
                <div style={{color:c,fontWeight:700,fontSize:15,marginTop:2}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{color:TT,fontSize:11,textAlign:'center',marginTop:10}}>Sources: ICMR-NIN 2020 · NIH DRI · WHO · Indian Food Composition Tables</div>
          <button onClick={onSave} style={{width:'100%',padding:16,background:GRN,border:'none',borderRadius:16,color:'#000',fontWeight:700,fontSize:17,cursor:'pointer',fontFamily:'inherit',marginTop:16}}>Start Tracking →</button>
          {hasProfile&&<button onClick={onCancel} style={{width:'100%',padding:12,background:'transparent',border:'none',borderRadius:16,color:TS,fontSize:14,cursor:'pointer',fontFamily:'inherit',marginTop:8}}>Cancel</button>}
        </Card>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════
export default function App(){
  const [tab,setTab]=useState('today')
  const [logs,setLogs]=useState([])
  const [profile,setProfile]=useState(null)
  const [customGoals,setCustomGoalsState]=useState({})
  const [goals,setGoals]=useState({})
  const [draft,setDraft]=useState({name:'',age:25,gender:'male',weight:70,height:170,activity:'moderate',goal:'maintain'})
  const [showSetup,setShowSetup]=useState(false)
  const [busy,setBusy]=useState(false)
  const [notif,setNotif]=useState(null)
  const [expandedId,setExpandedId]=useState(null)
  const [showAll,setShowAll]=useState(false)
  const [editEntry,setEditEntry]=useState(null)
  const [glasses,setGlassesState]=useState(0)
  const [aiTips,setAiTips]=useState(null)
  const [loadingTips,setLoadingTips]=useState(false)

  // Auto-refresh: register service worker update handler
  useEffect(()=>{
    if('serviceWorker' in navigator){
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        window.location.reload()
      })
    }
  },[])

  useEffect(()=>{
    const p=store.get('profile')
    const l=store.get('logs')
    const cg=store.get('customGoals')
    const g=store.get('glasses-'+new Date().toISOString().split('T')[0])
    if(p){setProfile(p);const calc=calcGoals(p,cg||{});setGoals(calc);setDraft(p)}
    else setShowSetup(true)
    if(l)setLogs(l)
    if(cg)setCustomGoalsState(cg)
    if(g!=null)setGlassesState(g)
  },[])

  const toast=useCallback((msg,err=false)=>{setNotif({msg,err});setTimeout(()=>setNotif(null),3200)},[])

  const saveProfile=useCallback(()=>{
    const g=calcGoals(draft,customGoals)
    setProfile(draft);setGoals(g)
    store.set('profile',draft)
    setShowSetup(false)
    toast('Goals personalized! 🎯')
  },[draft,customGoals,toast])

  const setCustomGoals=useCallback((cg)=>{
    setCustomGoalsState(cg)
    store.set('customGoals',cg)
    if(profile){const g=calcGoals(profile,cg);setGoals(g)}
  },[profile])

  const setGlasses=useCallback((n)=>{
    setGlassesState(n)
    store.set('glasses-'+new Date().toISOString().split('T')[0],n)
  },[])

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

  // Generate AI tips when today's food logs change
  useEffect(()=>{
    if(!profile||fl.length===0)return
    const deficiencies=getDeficiencies(tots,goals)
    if(deficiencies.length===0){setAiTips(null);return}
    setLoadingTips(true)
    generateSmartTips(deficiencies,profile,logs.filter(l=>l.date===today)).then(tips=>{
      if(tips)setAiTips(Array.isArray(tips)?tips:[tips])
      setLoadingTips(false)
    }).catch(()=>setLoadingTips(false))
  },[fl.length])

  const handleLog=useCallback(async(inp,itype,chosenTime,clearInput,setClarify)=>{
    if(busy)return
    setBusy(true)
    const profStr=profile?`${profile.age}yr ${profile.gender}, ${profile.weight}kg, ${profile.height}cm, ${ACT_LABELS[profile.activity]}, goal: ${GOAL_LABELS[profile.goal]}`:'unknown'
    try{
      let parsed
      if(itype==='food'){
        const result=await parseFoodEntry(inp,profStr)
        // Check if AI needs clarification
        if(result.needsClarification&&setClarify){
          setBusy(false)
          setClarify({question:result.question,originalText:inp})
          return
        }
        parsed=result
      } else if(itype==='exercise'){
        parsed=await parseExerciseEntry(inp)
      } else {
        parsed=await parseWeightEntry(inp)
        parsed.weight=parseFloat((+parsed.weight).toFixed(2))
      }

      const entryId=Date.now()
      const entryDate=chosenTime.toISOString().split('T')[0]
      const entry={id:entryId,type:itype,rawText:inp,timestamp:chosenTime.toISOString(),date:entryDate,parsed,opinion:null,loadingOpinion:itype==='food'&&!!profile}
      const nl=[entry,...logs]
      setLogs(nl);store.set('logs',nl);clearInput()
      setBusy(false)
      const lbl=itype==='food'?(parsed.name||'Food'):itype==='exercise'?parsed.activity:`${parseFloat(parsed.weight).toFixed(2)} kg`
      toast(`✓ ${lbl} logged!`)

      if(itype==='food'&&profile){
        const totsAfter=NUTR.reduce((a,n)=>({...a,[n.k]:(tots[n.k]||0)+(parsed[n.k]||0)}),{})
        try{
          const opinion=await getMealOpinion(parsed,profile,totsAfter,goals)
          setLogs(prev=>{const u=prev.map(l=>l.id===entryId?{...l,opinion:opinion.trim(),loadingOpinion:false}:l);store.set('logs',u);return u})
        }catch{
          setLogs(prev=>prev.map(l=>l.id===entryId?{...l,loadingOpinion:false}:l))
        }
      }
    }catch(e){
      setBusy(false)
      toast(e.message||'Could not parse — please try again',true)
    }
  },[busy,logs,tots,goals,profile,toast])

  const handleDelete=useCallback((id)=>{
    if(!window.confirm('Delete this entry?'))return
    const u=logs.filter(l=>l.id!==id)
    setLogs(u);store.set('logs',u);setEditEntry(null);toast('Entry deleted')
  },[logs,toast])

  const handleEditSave=useCallback(async(id,newText)=>{
    const entry=logs.find(l=>l.id===id)
    if(!entry)return
    setEditEntry(null);setBusy(true)
    const profStr=profile?`${profile.age}yr ${profile.gender}, ${profile.weight}kg, ${ACT_LABELS[profile.activity]}, goal: ${GOAL_LABELS[profile.goal]}`:'unknown'
    try{
      let parsed
      if(entry.type==='food') parsed=await parseFoodEntry(newText,profStr)
      else if(entry.type==='exercise') parsed=await parseExerciseEntry(newText)
      else{parsed=await parseWeightEntry(newText);parsed.weight=parseFloat((+parsed.weight).toFixed(2))}
      if(parsed.needsClarification)parsed={...entry.parsed}// keep original if still unclear
      const u=logs.map(l=>l.id===id?{...l,rawText:newText,parsed,opinion:null,loadingOpinion:entry.type==='food'&&!!profile}:l)
      setLogs(u);store.set('logs',u);setBusy(false);toast('✓ Entry updated!')
      if(entry.type==='food'&&profile){
        try{
          const op=await getMealOpinion(parsed,profile,tots,goals)
          setLogs(prev=>{const u2=prev.map(l=>l.id===id?{...l,opinion:op.trim(),loadingOpinion:false}:l);store.set('logs',u2);return u2})
        }catch{setLogs(prev=>prev.map(l=>l.id===id?{...l,loadingOpinion:false}:l))}
      }
    }catch(e){setBusy(false);toast(e.message||'Could not update',true)}
  },[logs,profile,tots,goals,toast])

  const clearLogs=useCallback(()=>{
    if(window.confirm('Delete all logs? Profile is kept.'))
      {store.remove('logs');setLogs([])}
  },[])

  const TABS=[['today','⚡','Today'],['log','➕','Log'],['reports','📊','Reports'],['profile','👤','Profile']]

  if(showSetup) return <SetupScreen draft={draft} setDraft={setDraft} onSave={saveProfile} onCancel={()=>setShowSetup(false)} hasProfile={!!profile}/>

  return(
    <div style={{background:BG,minHeight:'100dvh',maxWidth:430,margin:'0 auto',fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",sans-serif',color:TXT,position:'relative',overflowX:'hidden'}}>
      {notif&&(
        <div style={{position:'fixed',top:58,left:'50%',transform:'translateX(-50%)',background:notif.err?RED:GRN,color:'#000',padding:'10px 22px',borderRadius:22,fontWeight:700,fontSize:14,zIndex:400,whiteSpace:'nowrap',boxShadow:`0 4px 24px ${notif.err?RED:GRN}50`,transition:'all .3s'}}>
          {notif.msg}
        </div>
      )}
      <div style={{height:'100dvh',overflowY:'auto',scrollbarWidth:'none'}}>
        {tab==='today'&&<TodayView logs={logs} tots={tots} burned={burned} goals={goals} latestWt={latestWt} expandedId={expandedId} setExpandedId={setExpandedId} showAll={showAll} setShowAll={setShowAll} profile={profile} onEdit={setEditEntry} glasses={glasses} setGlasses={setGlasses} aiTips={aiTips} loadingTips={loadingTips}/>}
        {tab==='log'&&<LogView logs={logs} onLog={handleLog} busy={busy}/>}
        {tab==='reports'&&<ReportsView week={week} goals={goals} latestWt={latestWt} logs={logs}/>}
        {tab==='profile'&&<ProfileView profile={profile} goals={goals} customGoals={customGoals} onEdit={()=>setShowSetup(true)} onClearLogs={clearLogs} onSetCustomGoals={setCustomGoals}/>}
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
      {editEntry&&<EditModal entry={editEntry} onSave={handleEditSave} onDelete={handleDelete} onCancel={()=>setEditEntry(null)}/>}
    </div>
  )
}
