'use client';

import { useMemo, useState } from 'react';
import { OutcomeLegend, ReportPanel } from './ReportVisuals';
import styles from './TimelineReport.module.css';

type Obj = Record<string, unknown>;
type PeriodCell = { period: number; from: number; to: number; journeys: number; outcomes: Record<string, number> };
const outcomes = ['ai_confirmed', 'ai_unconfirmed', 'human_confirmed', 'human_unconfirmed', 'elsewhere', 'unknown', 'unresolved'];
const colors: Record<string, string> = { ai_confirmed: '#1c5cab', ai_unconfirmed: '#86b6ef', human_confirmed: '#177245', human_unconfirmed: '#8fd1a8', elsewhere: '#6b7688', unknown: '#d6dae0', unresolved: '#b64a3c' };
const names: Record<string, [string, string]> = { ai_confirmed: ['AI confirmed','AI 已证实'], ai_unconfirmed: ['AI unconfirmed','AI 未证实'], human_confirmed: ['Human confirmed','人工已证实'], human_unconfirmed: ['Human unconfirmed','人工未证实'], elsewhere: ['Self-resolved','自行解决'], unknown: ["Can't tell",'无法判断'], unresolved: ['Not resolved','未解决'] };
const weekdays: [string, string][] = [['Monday','周一'],['Tuesday','周二'],['Wednesday','周三'],['Thursday','周四'],['Friday','周五'],['Saturday','周六'],['Sunday','周日']];
function obj(value: unknown): Obj { return value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {}; }
function rows(value: unknown): Obj[] { return Array.isArray(value) ? value.map(obj) : []; }
function dateAt(start: Date, day: number): Date { return new Date(start.getTime() + day * 86400000); }
function dateText(start: Date, day: number): string { return dateAt(start, day).toISOString().slice(0, 10); }
function monthIndex(start: Date, day: number): number { const d=dateAt(start,day);return (d.getUTCFullYear()-start.getUTCFullYear())*12+d.getUTCMonth()-start.getUTCMonth(); }
function periodOf(start: Date, day: number, gran: 'day'|'week'|'month'): number { return gran==='day'?day:gran==='week'?Math.floor(day/7):monthIndex(start,day); }
function aggregate(daily: Obj[], gran: 'day'|'week'|'month', start: Date): Map<number, PeriodCell> {
  const result=new Map<number,PeriodCell>();
  for(const row of daily){const day=Number(row.day),period=periodOf(start,day,gran);
    const cell=result.get(period)??{period,from:day,to:day,journeys:0,outcomes:{}};
    cell.from=Math.min(cell.from,day);cell.to=Math.max(cell.to,day);cell.journeys+=Number(row.journeys??0);
    for(const [key,value] of Object.entries(obj(row.outcomes)))cell.outcomes[key]=(cell.outcomes[key]??0)+Number(value);
    result.set(period,cell);
  }
  return result;
}
function periodBounds(start: Date, days: number, gran: 'day'|'week'|'month'): Array<{period:number;from:number;to:number}> {
  const result=new Map<number,{period:number;from:number;to:number}>();
  for(let day=0;day<days;day++){const period=periodOf(start,day,gran),old=result.get(period);
    if(old)old.to=day;else result.set(period,{period,from:day,to:day});}
  return [...result.values()];
}
function Pie({ cell, max, zh }: {cell:PeriodCell;max:number;zh:boolean}) {
  const size=38,radius=Math.max(3,17*Math.sqrt(cell.journeys/Math.max(1,max)));
  const parts=outcomes.filter((key)=>cell.outcomes[key]>0);
  if(parts.length===1)return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true"><circle cx="19" cy="19" r={radius} fill={colors[parts[0]]} stroke="#fff" /></svg>;
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">{parts.map((key,index)=>{
    const angle=-Math.PI/2+Math.PI*2*parts.slice(0,index).reduce((sum,part)=>sum+cell.outcomes[part],0)/cell.journeys;
    const next=angle+Math.PI*2*cell.outcomes[key]/cell.journeys;
    const x1=19+radius*Math.cos(angle),y1=19+radius*Math.sin(angle),x2=19+radius*Math.cos(next),y2=19+radius*Math.sin(next);
    const path=`M19 19 L${x1.toFixed(3)} ${y1.toFixed(3)} A${radius} ${radius} 0 ${next-angle>Math.PI?1:0} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
    return <path key={key} d={path} fill={colors[key]} stroke="#fff" strokeWidth=".7"><title>{names[key][zh?1:0]}: {cell.outcomes[key]}</title></path>;
  })}</svg>;
}

export default function TimelineReport({ data, zh, windowStart, filters, onFilter, onJourneys, onUser }: {
  data: Obj;zh:boolean;windowStart:string;filters:Record<string,string>;
  onFilter:(name:string,value:string)=>void;onJourneys:(title:string,detail:Record<string,string>)=>void;onUser:(id:string)=>void;
}) {
  const [gran,setGran]=useState<'day'|'week'|'month'>('week');
  const [view,setView]=useState<'topic'|'group'|'people'|'local'>('topic');
  const start=useMemo(()=>new Date(new Date(windowStart).getTime()+8*3600000),[windowStart]);
  const composition=obj(data.composition), grouped=obj(composition.grouped), local=obj(composition.local);
  const overall=rows(composition.overall), days=Number(obj(data.timeline).days)||184;
  const bounds=periodBounds(start,days,gran), totals=aggregate(overall,gran,start);
  const topicSelected=!!filters.topic,subtopicSelected=!!filters.subtopic;
  const dim=topicSelected?'subtopic':'topic';
  const lanes=rows(grouped[dim]).filter((row)=>Number(row.total)>0);
  const laneCells=lanes.map((row)=>({name:String(row.group),total:Number(row.total),periods:aggregate(rows(row.daily),gran,start)}));
  const maxLane=Math.max(1,...laneCells.flatMap((lane)=>[...lane.periods.values()].map((cell)=>cell.journeys)));
  const maxOverall=Math.max(1,...[...totals.values()].map((cell)=>cell.journeys));
  const cellWidth=gran==='month'?82:gran==='week'?46:42;
  const openCell=(name:string,cell:PeriodCell,group?:string)=>onJourneys(`${name} · ${dateText(start,cell.from)}${cell.from===cell.to?'':` → ${dateText(start,cell.to)}`}`,
    {...(group?{[dim]:group}:{}),day_from:String(cell.from),day_to:String(cell.to)});
  const returnUp=()=>{if(subtopicSelected)onFilter('subtopic','');else if(topicSelected)onFilter('topic','');};
  const personRows=rows(obj(data.people).rows);
  const localMap=new Map(rows(local.cells).map((row)=>[`${row.weekday}|${row.hour}`,Number(row.journeys)]));
  const localMax=Math.max(1,...localMap.values());
  return <ReportPanel title={zh?'新旅程与解决结果':'New journeys and outcomes'} description={zh?'圆面积表示新旅程数量，颜色表示解决结果；点击圆形、柱子或时段查看明细。':'Pie area shows new journey volume; color shows outcome. Open a pie, bar or time cell for details.'}>
    <div className={styles.controls}><div className={styles.segmented} aria-label={zh?'时间粒度':'Time granularity'}>{(['day','week','month'] as const).map((item)=><button key={item} className={gran===item?styles.active:''} onClick={()=>setGran(item)}>{zh?{day:'日',week:'周',month:'月'}[item]:{day:'Day',week:'Week',month:'Month'}[item]}</button>)}</div>
      <div className={styles.segmented} aria-label={zh?'时间线视图':'Timeline view'}>{(['topic','group','people','local'] as const).map((item)=><button key={item} className={view===item?styles.active:''} onClick={()=>setView(item)}>{zh?{topic:'按主题',group:'分组',people:'按个人',local:'本地时段'}[item]:{topic:'Topics',group:'Groups',people:'People',local:'Local time'}[item]}</button>)}</div><span>UTC+08:00</span></div>
    {(view==='topic'||view==='group')&&<OutcomeLegend zh={zh}/>}
    {view==='topic'&&<><div className={styles.pieScroll}><div className={styles.pieGrid} style={{gridTemplateColumns:`190px repeat(${bounds.length}, ${cellWidth}px)`}}>
      <div className={`${styles.label} ${styles.header}`}>{zh?'主题 / 期间':'Topic / period'}</div>
      {bounds.map((bound)=><div className={styles.periodHead} key={bound.period} title={`${dateText(start,bound.from)} → ${dateText(start,bound.to)}`}>{gran==='month'?dateText(start,bound.from).slice(0,7):dateText(start,bound.from).slice(5)}</div>)}
      {[{name:'*',total:overall.reduce((n,row)=>n+Number(row.journeys),0),periods:totals},...laneCells].map((lane)=><div className={styles.laneContents} key={lane.name} style={{display:'contents'}}>
        <div className={styles.label}>{lane.name==='*'?<button onClick={returnUp} disabled={!topicSelected} title={zh?'全部主题；点击返回上一层':'All topics; return to parent'}>{topicSelected?'↑ ':''}{zh?'全部主题':'All topics'} <b>{lane.total.toLocaleString()}</b></button>
          :<button onClick={()=>onFilter(dim,lane.name)} disabled={subtopicSelected} title={zh?'点击查看下一层':'Open next level'}>{lane.name} <b>{lane.total.toLocaleString()}</b></button>}</div>
        {bounds.map((bound)=>{const cell=lane.periods.get(bound.period);return <div className={styles.pieSlot} key={bound.period}>{cell&&<button className={styles.pieButton} onClick={()=>openCell(lane.name==='*'?(zh?'全部主题':'All topics'):lane.name,cell,lane.name==='*'?undefined:lane.name)}
          aria-label={`${lane.name==='*'?(zh?'全部主题':'All topics'):lane.name} · ${dateText(start,bound.from)} · ${cell.journeys} ${zh?'条旅程':'journeys'}`}
          title={`${cell.journeys} ${zh?'条旅程':'journeys'} · ${outcomes.filter((key)=>cell.outcomes[key]).map((key)=>`${names[key][zh?1:0]} ${cell.outcomes[key]}`).join(' · ')}`}>
          <Pie cell={cell} max={lane.name==='*'?maxOverall:maxLane} zh={zh}/></button>}</div>;})}
      </div>)}
      </div></div><p className={styles.note}>{zh?'点击左侧主题进入子主题；点击顶部“全部主题”返回。每个圆形按对应日期和当前筛选打开旅程。':'Open a topic to see subtopics; use All topics to go back. Each pie opens journeys for its period and current filters.'}</p></>}
    {view==='group'&&<><div className={styles.bars}>{bounds.map((bound)=>{const cell=totals.get(bound.period);return <button key={bound.period} className={styles.barColumn} onClick={()=>cell&&openCell(zh?'全部旅程':'All journeys',cell)} disabled={!cell} title={cell?`${dateText(start,bound.from)} · ${cell.journeys}`:''}>
      <div className={styles.barStack} style={{height:`${cell?Math.max(2,100*cell.journeys/maxOverall):0}%`}}>{outcomes.map((key)=>cell?.outcomes[key]?<span key={key} style={{height:`${100*cell.outcomes[key]/cell.journeys}%`,background:colors[key]}}/>:null)}</div><small>{gran==='month'?dateText(start,bound.from).slice(0,7):dateText(start,bound.from).slice(5)}</small></button>;})}</div>
      <p className={styles.note}>{zh?'每列是一段时间的新旅程，堆叠颜色对应解决结果。':'Each stacked column counts new journeys in one period, split by outcome.'}</p></>}
    {view==='people'&&<><p className={styles.note}>{zh?`按旅程数显示前 ${personRows.length} 位用户，共 ${Number(obj(data.people).total_people??0).toLocaleString()} 位。横条显示旅程跨度与结果；点击姓名或横条查看用户明细。`:`Showing ${personRows.length} of ${Number(obj(data.people).total_people??0).toLocaleString()} people by journey count. Bars show each journey's span and outcome; open a name or bar for user details.`}</p>
      <div className={styles.people}>{personRows.map((row)=><div className={styles.personRow} key={String(row.group)}><button onClick={()=>onUser(String(row.group))}>{String(row.group)} <b>{Number(row.total)}</b></button><div className={styles.personTrack}>{rows(row.events??row.daily).map((event,index)=>{const day=Number(event.day),end=Math.max(day,Number(event.end_day??day)),outcome=String(event.outcome??'unknown');return <button key={`${day}-${index}`}
        style={{left:`${100*day/Math.max(1,days)}%`,width:`max(4px, ${100*(end-day+1)/Math.max(1,days)}%)`,background:colors[outcome]??'#2f5fc4'}}
        title={`${dateText(start,day)}${end>day?` → ${dateText(start,end)}`:''} · ${names[outcome]?.[zh?1:0]??outcome}`}
        aria-label={`${row.group} · ${dateText(start,day)}${end>day?` → ${dateText(start,end)}`:''} · ${names[outcome]?.[zh?1:0]??outcome}`}
        onClick={()=>onUser(String(row.group))}/>;})}</div></div>)}</div></>}
    {view==='local'&&<><p className={styles.note}>{zh?`用户当地时间：${Number(local.included??0).toLocaleString()} 条有星期与小时；${Number(local.missing??0).toLocaleString()} 条缺失。点击格子查看明细。`:`User local time: ${Number(local.included??0).toLocaleString()} journeys have weekday and hour; ${Number(local.missing??0).toLocaleString()} do not. Open a cell for details.`}</p>
      <div className={styles.heatScroll}><div className={styles.heatGrid}><span/>{Array.from({length:24},(_,hour)=><span key={hour}>{String(hour).padStart(2,'0')}</span>)}
      {weekdays.map(([en,cn],weekday)=><div className={styles.heatRow} key={en} style={{display:'contents'}}><strong>{zh?cn:en}</strong>{Array.from({length:24},(_,hour)=>{const n=localMap.get(`${weekday}|${hour}`)??0;return <button key={hour} style={{background:`rgba(47,95,196,${n?0.12+0.78*n/localMax:0.025})`}} disabled={!n}
        onClick={()=>onJourneys(`${zh?cn:en} ${String(hour).padStart(2,'0')}:00`,{local_weekday:String(weekday),local_hour:String(hour)})}
        title={`${zh?cn:en} ${String(hour).padStart(2,'0')}:00 · ${n}`} aria-label={`${zh?cn:en} ${String(hour).padStart(2,'0')}:00 · ${n} ${zh?'条旅程':'journeys'}`}>{n||''}</button>;})}</div>)}</div></div></>}
  </ReportPanel>;
}
