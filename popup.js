/* Chrome Extension version of 摸鱼办 v3.4 */

const STORAGE_KEY = "moyu_v34_chrome";
const DEFAULT = {
    start: "09:00",
    end: "18:00",
    hire: new Date().toISOString().split("T")[0],
    gender: "male",
    refresh: 60,
    dark: "off",
    activeStart: "09:00",
    activeEnd: "11:00",
    salaryDay: 20,
    weekdays: "1-5",
    custom: []
};

let cfg = {};
let timer = null;

// Chrome storage API wrapper
const storage = {
    get: (key) => {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key]);
            });
        });
    },
    set: (key, value) => {
        return new Promise((resolve) => {
            chrome.storage.local.set({[key]: value}, resolve);
        });
    }
};

// load settings
async function load(){
    try {
        const data = await storage.get(STORAGE_KEY);
        cfg = Object.assign({}, DEFAULT, data || {});
    } catch(e) {
        cfg = Object.assign({}, DEFAULT);
    }
    document.body.classList.toggle("dark", cfg.dark === "on");
}

// save settings
async function save(){
    cfg.start = document.getElementById("cfg-start").value || DEFAULT.start;
    cfg.end = document.getElementById("cfg-end").value || DEFAULT.end;
    cfg.hire = document.getElementById("cfg-hire").value || DEFAULT.hire;
    cfg.gender = document.getElementById("cfg-gender").value || DEFAULT.gender;
    cfg.activeStart = document.getElementById("cfg-active-start").value || DEFAULT.activeStart;
    cfg.activeEnd = document.getElementById("cfg-active-end").value || DEFAULT.activeEnd;
    cfg.refresh = Math.max(5, parseInt(document.getElementById("cfg-refresh").value) || DEFAULT.refresh);
    cfg.dark = document.getElementById("cfg-dark").value || DEFAULT.dark;
    cfg.weekdays = document.getElementById("cfg-weekdays").value || "1-5";
    cfg.salaryDay = parseInt(document.getElementById("cfg-salaryday").value) || DEFAULT.salaryDay;

    const customs = [];
    for(let i=1;i<=5;i++){
        const name = document.getElementById(`c${i}-name`).value.trim();
        const date = document.getElementById(`c${i}-date`).value;
        if(name && date) customs.push({n:name, d:date});
    }
    cfg.custom = customs;

    await storage.set(STORAGE_KEY, cfg);
    document.body.classList.toggle("dark", cfg.dark === "on");
    start();
}

// fill panel with current cfg
function fillPanel(){
    document.getElementById("cfg-start").value = cfg.start;
    document.getElementById("cfg-end").value = cfg.end;
    document.getElementById("cfg-hire").value = cfg.hire;
    document.getElementById("cfg-gender").value = cfg.gender;
    document.getElementById("cfg-active-start").value = cfg.activeStart;
    document.getElementById("cfg-active-end").value = cfg.activeEnd;
    document.getElementById("cfg-refresh").value = cfg.refresh;
    document.getElementById("cfg-dark").value = cfg.dark;
    document.getElementById("cfg-weekdays").value = cfg.weekdays || "1-5";
    document.getElementById("cfg-salaryday").value = cfg.salaryDay;
    for(let i=1;i<=5;i++){
        document.getElementById(`c${i}-name`).value = cfg.custom[i-1]?.n || "";
        document.getElementById(`c${i}-date`).value = cfg.custom[i-1]?.d || "";
    }
}

// helper functions
function fmtMs(ms){
    if(ms <= 0) return "已到";
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${d}天${h}小时${m}分钟`;
}
function daysCeil(a,b){ return Math.ceil((b - a) / 86400000); }
function clamp(n,min,max){ return Math.min(max, Math.max(min, n)); }

// update UI
function update(){
    const now = new Date();
    document.getElementById("nowTime").textContent = now.toLocaleString();
    document.getElementById("tz").textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // 今日进度
    const [sh,sm] = cfg.start.split(":").map(Number);
    const [eh,em] = cfg.end.split(":").map(Number);
    const dayStart = new Date(now); dayStart.setHours(sh,sm,0,0);
    const dayEnd = new Date(now); dayEnd.setHours(eh,em,0,0);
    const pctToday = clamp((now - dayStart) / (dayEnd - dayStart) * 100, 0, 100);
    document.getElementById("bar-today").style.width = pctToday.toFixed(2) + "%";
    document.getElementById("today-info").textContent = `已过 ${pctToday.toFixed(1)}%，离下班 ${fmtMs(dayEnd - now)}`;

    // 本周进度
    const weekRange = (cfg.weekdays || "1-5").split("-");
    const startDay = parseInt(weekRange[0]), endDay = parseInt(weekRange[1]);
    const cur = new Date(now);
    const day = cur.getDay() || 7;
    const weekStart = new Date(cur); weekStart.setDate(cur.getDate() - (day - startDay)); weekStart.setHours(0,0,0,0);
    const weekEnd = new Date(cur); weekEnd.setDate(cur.getDate() + (endDay - day)); weekEnd.setHours(23,59,59,999);
    const weekPct = clamp((now - weekStart) / (weekEnd - weekStart) * 100, 0, 100);
    document.getElementById("bar-week").style.width = weekPct.toFixed(2) + "%";
    document.getElementById("week-info").textContent = `已过 ${weekPct.toFixed(1)}%，剩余 ${(100-weekPct).toFixed(1)}%`;

    // 周末倒计时
    const nextSat = new Date(now); nextSat.setDate(now.getDate() + ((6 - now.getDay()) % 7)); nextSat.setHours(0,0,0,0);
    document.getElementById("weekend").textContent = fmtMs(nextSat - now);

    // 发薪倒计时
    let pay = new Date(now.getFullYear(), now.getMonth(), cfg.salaryDay);
    if (now > pay) pay.setMonth(pay.getMonth() + 1);
    document.getElementById("salary").textContent = fmtMs(pay - now);

    // 自定义倒计时
    const cl = document.getElementById("custom-list"); cl.innerHTML = "";
    for(let i=0;i<5;i++){
        const c = cfg.custom[i];
        const li = document.createElement("li");
        if(c){
            const t = new Date(c.d);
            li.textContent = `${c.n}：还有 ${daysCeil(now,t)} 天`;
        } else li.textContent = `${i+1}. 未设置`;
        cl.appendChild(li);
    }

    // 节假日
    const HOL = [
        {n:"元旦",m:1,d:1},
        {n:"春节",m:2,d:1},
        {n:"清明节",m:4,d:4},
        {n:"劳动节",m:5,d:1},
        {n:"国庆节",m:10,d:1}
    ];
    const hl = document.getElementById("holiday-list"); hl.innerHTML="";
    HOL.forEach(h=>{
        let t = new Date(now.getFullYear(),h.m-1,h.d);
        if(t<now) t.setFullYear(t.getFullYear()+1);
        const li=document.createElement("li");
        li.textContent=`${h.n}：还有 ${daysCeil(now,t)} 天`;
        hl.appendChild(li);
    });

    // 退休倒计时
    const hireDate = new Date(cfg.hire);
    const retireYears = cfg.gender==="female"?55:60;
    const retireDate = new Date(hireDate); retireDate.setFullYear(hireDate.getFullYear()+retireYears);
    const totalMonths = (retireDate.getFullYear()-hireDate.getFullYear())*12 + retireDate.getMonth()-hireDate.getMonth();
    const passedMonths = (now.getFullYear()-hireDate.getFullYear())*12 + now.getMonth()-hireDate.getMonth();
    const pct = clamp(passedMonths/totalMonths*100,0,100);
    document.getElementById("bar-retire").style.width = pct.toFixed(2)+"%";
    document.getElementById("retire-info").textContent = `入职：${cfg.hire} ・ 退休年龄：${retireYears}岁`;
    document.getElementById("retire-remaining").textContent = `已工作 ${passedMonths} 个月 · 剩余 ${totalMonths - passedMonths} 个月`;

    // 智能摸鱼语录
    const quoteEl = document.getElementById("quote");
    const activeQuotes = [
        "摸鱼是门艺术，要讲节奏 🎨",
        "认真摸鱼，快乐加倍 🐠",
        "效率摸鱼两不误 💼"
    ];
    const relaxQuotes = [
        "摸鱼使我快乐 😎",
        "摸鱼是对工作的尊重 ✨",
        "你摸，我摸，大家都摸 🐟"
    ];

    const hr = now.getHours();
    const [ah, am] = cfg.activeStart.split(":").map(Number);
    const [bh, bm] = cfg.activeEnd.split(":").map(Number);
    const activeStart = ah * 60 + am;
    const activeEnd = bh * 60 + bm;
    const current = hr * 60 + now.getMinutes();

    let quote = "";
    if (current >= activeStart && current <= activeEnd) {
        quote = activeQuotes[Math.floor(Math.random() * activeQuotes.length)];
    } else {
        quote = relaxQuotes[Math.floor(Math.random() * relaxQuotes.length)];
    }
    quoteEl.textContent = quote;
}

// start timer
function start(){
    if(timer) clearInterval(timer);
    update();
    timer = setInterval(update, cfg.refresh * 1000);
}

// create bubbles
function createBubbles(){
    const wrapper = document.getElementById("bubbles");
    wrapper.innerHTML = "";
    for(let i=0;i<8;i++){
        const b = document.createElement("div");
        b.className = "bubble";
        const size = Math.round(Math.random()*30 + 8);
        b.style.width = size + "px";
        b.style.height = size + "px";
        b.style.left = (Math.random()*90) + "%";
        b.style.animationDuration = (12 + Math.random()*12) + "s";
        b.style.animationDelay = (Math.random()*8) + "s";
        wrapper.appendChild(b);
    }
}

// UI bindings
document.getElementById("btn-settings").onclick = () => {
    const p = document.getElementById("panel");
    p.style.display = (p.style.display === "block") ? "none" : "block";
    fillPanel();
};

document.getElementById("save").onclick = async () => {
    await save();
    document.getElementById("panel").style.display = "none";
};

// init
document.addEventListener('DOMContentLoaded', async () => {
    await load();
    createBubbles();
    start();
});
