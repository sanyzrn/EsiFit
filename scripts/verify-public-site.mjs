/** Local disposable browser regression. Requires a running production build.
 * DATABASE_URL=.../esifit_seed BASE_URL=http://127.0.0.1:3110
 * PLAYWRIGHT_RUNTIME=/path/to/runtime CHROMIUM_EXECUTABLE_PATH=/path/to/chromium
 * node scripts/verify-public-site.mjs
 * Demo allowlist: 09121110860,09121110861. Never targets a live database. */
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const target=new URL(process.env.DATABASE_URL??"");
const base=process.env.BASE_URL??"http://127.0.0.1:3110";
if(!["127.0.0.1","localhost"].includes(target.hostname)||!/^\/esifit_(?:seed|test)$/.test(target.pathname)||!["127.0.0.1","localhost"].includes(new URL(base).hostname))throw new Error("Disposable local database/server required");
const appRequire=createRequire(join(root,"package.json"));
const runtimeRequire=createRequire(process.env.PLAYWRIGHT_RUNTIME?join(resolve(process.env.PLAYWRIGHT_RUNTIME),"package.json"):join(root,"package.json"));
const {PrismaClient}=appRequire("@prisma/client");const {chromium}=runtimeRequire("playwright");const db=new PrismaClient();
for(const[phone,onboarded]of[["09121110860",true],["09121110861",false]])await db.user.upsert({where:{phone},create:{phone,displayName:"تست رابط",tier:"free",profile:{create:{onboardedAt:onboarded?new Date():null}}},update:{role:"member",tier:"free",profile:{upsert:{create:{onboardedAt:onboarded?new Date():null},update:{onboardedAt:onboarded?new Date():null}}}}});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:["--no-sandbox","--disable-dev-shm-usage"]});const errors=[];
try{
 const context=await browser.newContext({reducedMotion:"reduce"});const page=await context.newPage();page.on("pageerror",e=>errors.push({url:page.url(),message:e.message}));
 for(const viewport of[{width:390,height:844},{width:1280,height:800}]){await page.setViewportSize(viewport);for(const path of["/","/store","/plans","/calculators/bmi","/missing-audit-route"]){const response=await page.goto(base+path);assert.equal(response.status(),path.startsWith("/missing")?404:200);assert.equal(await page.locator("main#main-content").count(),1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(path==="/store")assert.ok(await page.locator("main article").count()>0)}}
 await page.setViewportSize({width:390,height:844});await page.goto(base);await page.keyboard.press("Tab");assert.equal(await page.evaluate(()=>document.activeElement.textContent),"پرش به محتوا");await page.keyboard.press("Enter");assert.equal(await page.evaluate(()=>document.activeElement.id),"main-content");
 await page.getByRole("button",{name:"حالت روشن",exact:true}).click();await page.waitForFunction(()=>document.documentElement.classList.contains("light"));await page.goto(base+"/store");await page.waitForFunction(()=>document.documentElement.classList.contains("light"));
 async function login(p,phone){await p.getByLabel("شماره موبایل",{exact:true}).fill(phone);await p.getByRole("button",{name:"دریافت کد ورود",exact:true}).click();const status=p.getByRole("status");await status.waitFor();const code=(await status.innerText()).match(/[۰-۹0-9]{6}/)?.[0];assert.ok(code);await p.locator('input[autocomplete="one-time-code"]').fill(code.replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d)))}
 await page.goto(base+"/settings");assert.match(page.url(),/auth\/login\?next=%2Fsettings/);await login(page,"09121110860");await page.waitForURL(base+"/settings");await page.goto(base+"/dashboard");await page.reload();await page.waitForTimeout(300);
 const fresh=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});const setup=await fresh.newPage();setup.on("pageerror",e=>errors.push({url:setup.url(),message:e.message}));await setup.goto(base+"/auth/login?next=%2Fsettings");await login(setup,"09121110861");await setup.waitForURL(/auth\/onboarding\?next=%2Fsettings/);await setup.getByLabel("سال تولد (شمسی)",{exact:true}).fill("۱۳۷۰");await setup.getByRole("button",{name:"ادامه",exact:true}).click();await setup.getByLabel("قد (سانتی‌متر)",{exact:true}).fill("۱۷۸");await setup.getByLabel("وزن فعلی (کیلوگرم)",{exact:true}).fill("۸۲");await setup.getByRole("button",{name:"ادامه",exact:true}).click();await setup.getByRole("button",{name:"شروع کن 🚀",exact:true}).click();await setup.waitForURL(base+"/settings");
 const bare=await browser.newContext({javaScriptEnabled:false});const html=await bare.newPage();await html.goto(base+"/store");assert.ok(await html.locator("main article").first().isVisible());assert.equal(await html.locator('link[rel="canonical"]').getAttribute("href"),"https://esi-fit.vercel.app/store");
 const tooLarge=await fetch(base+"/api/auth/request-otp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:"09121110860",padding:"a".repeat(1024*1024)})});assert.equal(tooLarge.status,413);
 await page.goto(base+"/offline");await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);await context.setOffline(true);await page.goto(base+"/uncached-offline-audit");await page.getByRole("heading",{name:"اتصال اینترنت قطع است"}).waitFor();assert.equal(await page.evaluate(async()=>{try{await fetch("/api/auth/me");return false}catch{return true}}),true);await context.setOffline(false);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({publicViewports:"pass",skipLink:"pass",themePersistence:"pass",otpDestination:"pass",onboardingDestination:"pass",noJavaScriptCatalog:"pass",oversizedBody:"413",serviceWorkerOfflineFallback:"pass",offlineApi:"network-only",pageErrors:errors}));
}finally{await browser.close();await db.$disconnect()}
