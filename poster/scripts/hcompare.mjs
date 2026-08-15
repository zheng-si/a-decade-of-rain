// Horizontal comparison strip. Usage: node hcompare.mjs OUT each name:label name:label ...
import { chromium } from 'playwright-core'
import fs from 'fs'
const SP=process.env.SP
const [out, eachS, ...pairs]=process.argv.slice(2)
const each=+eachS, gap=34
const items=pairs.map(p=>{const i=p.indexOf(':'); return [p.slice(0,i), p.slice(i+1)]})
const eh=Math.round(each/2828*4000)
const W=each*items.length+gap*(items.length+1), Ht=eh+96
const cells=items.map(([n,lab])=>{
  const sv=fs.readFileSync(`${SP}/${n}.svg`,'utf8').replace('width="2828" height="4000"',`width="${each}" height="${eh}"`)
  return `<div class="c"><div class="lab">${lab}</div>${sv}</div>`
}).join('')
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']})
const p=await b.newPage({viewport:{width:W,height:Ht}})
await p.setContent(`<style>html,body{margin:0;background:#e9e7df;font-family:sans-serif}#r{display:flex;gap:${gap}px;padding:${gap}px}.c{background:#faf9f4;box-shadow:0 3px 14px rgba(0,0,0,.13)}.lab{font-size:22px;color:#333;padding:18px 0 10px;text-align:center;letter-spacing:1px}svg{display:block}</style><div id="r">${cells}</div>`)
await p.waitForTimeout(900); await p.screenshot({path:`${SP}/${out}.png`}); await b.close()
console.log(out, W+'x'+Ht)
