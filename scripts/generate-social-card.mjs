/** Optional development renderer; does not add browser dependencies to the app.
 * PLAYWRIGHT_RUNTIME=/path/to/runtime CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node scripts/generate-social-card.mjs */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const require=createRequire(process.env.PLAYWRIGHT_RUNTIME ? join(resolve(process.env.PLAYWRIGHT_RUNTIME),"package.json") : join(root,"package.json"));
const {chromium}=require("playwright");
const css=await readFile(join(root,"src/app/globals.css"),"utf8");const dark=css.slice(css.indexOf(":root,"),css.indexOf(".light {"));
const token=name=>{const value=dark.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1];if(!value)throw new Error(`Missing token ${name}`);return value};
const font=name=>pathToFileURL(join(root,"public/fonts",name)).href;
const logo=await readFile(join(root,"public/icons/logo-mark.svg"),"utf8");
const html=`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><style>
@font-face{font-family:Vazir;src:url('${font("Vazirmatn-Regular.woff2")}')}@font-face{font-family:Lalezar;src:url('${font("Lalezar-Regular.woff2")}')}
*{box-sizing:border-box}body{margin:0;width:1200px;height:630px;background:${token("background")};color:${token("text-primary")};font-family:Vazir;display:flex;align-items:center;justify-content:space-between;padding:64px;gap:64px;border-bottom:16px solid ${token("primary")}}.copy{flex:1}h1{font-family:Lalezar;font-weight:400;font-size:80px;line-height:1.2;margin:0 0 32px}.accent{color:${token("primary")}}p{color:${token("text-secondary")};font-size:28px;line-height:1.8;margin:0}.brand{width:280px;text-align:center;flex-shrink:0}.brand svg{width:256px;height:256px;display:block;margin:0 auto 32px}.name{font-size:40px;letter-spacing:8px;color:${token("text-primary")}}</style><body><section class="copy"><h1>هر روز،<br><span class="accent">قوی‌تر از دیروز</span></h1><p>تمرین، تغذیه و پیشرفت<br>همراه هوشمند تناسب اندام شما</p></section><div class="brand">${logo}<div class="name" dir="ltr">ESIFIT</div></div></body></html>`;
const dir=await mkdtemp(join(tmpdir(),"esifit-social-"));const source=join(dir,"card.html");await writeFile(source,html);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:["--no-sandbox","--disable-dev-shm-usage"]});
try{const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});await page.goto(pathToFileURL(source).href);await page.evaluate(()=>document.fonts.ready);await mkdir(join(root,"public/og"),{recursive:true});await page.screenshot({path:join(root,"public/og/esifit.png")});console.log("Generated 1200×630 social card")}finally{await browser.close()}
