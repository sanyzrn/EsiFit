import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ensureSeed, createUser, db } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { createSession } from "@/lib/auth/session";
import { GET as catalog } from "@/app/api/store/products/route";
import { getCatalog } from "@/lib/commerce/catalog";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
beforeEach(async()=>{await ensureSeed();clearCookies()});afterEach(()=>vi.unstubAllEnvs());
describe("public catalog and discovery",()=>{
 it("shares live stock/prices between SSR/API without leaking member discounts",async()=>{
  const p=await db.product.create({data:{slug:"public-product",nameFa:"محصول عمومی",priceToman:389001,stock:3}});await db.product.create({data:{slug:"hidden",nameFa:"مخفی",priceToman:1,status:"archived"}});
  expect((await getCatalog()).products).toHaveLength(1);let response=await catalog();expect((await response.json()).products[0].finalPriceToman).toBe(389001);expect(response.headers.get("Cache-Control")).toContain("private");
  const vip=await createUser("09121110801",{tier:"vip_plus"});await createSession(vip.id,"vip");expect((await (await catalog()).json()).products[0].finalPriceToman).toBe(Math.round(389001*.9));
  await db.product.update({where:{id:p.id},data:{stock:1,priceToman:400000}});expect((await getCatalog("vip_plus")).products[0]).toMatchObject({stock:1,finalPriceToman:360000});clearCookies();expect((await (await catalog()).json()).products[0].finalPriceToman).toBe(400000);
 });
 it("discovers the public store while retaining private exclusions",async()=>{vi.stubEnv("NEXT_PUBLIC_SITE_URL","https://fitness.test/");const p=robots();expect(p.sitemap).toBe("https://fitness.test/sitemap.xml");const r=Array.isArray(p.rules)?p.rules[0]:p.rules;expect(r.disallow).not.toContain("/store");expect(r.disallow).toContain("/settings");const list=await sitemap();expect(list.some(e=>e.url==="https://fitness.test/store")).toBe(true);expect(list.some(e=>e.url==="https://fitness.test/community")).toBe(false)});
});
