import { describe, expect, it } from "vitest";
import { loginPath, onboardingPath, safeReturnPath } from "@/lib/auth/return-path";
import { siteOrigin, publicMetadata } from "@/lib/seo/site";
describe("public-site URL boundaries", () => {
  it("preserves internal destinations and rejects redirects/auth loops", () => {
    const path="/workout/live?session=owned-id&planDay=today#capture";expect(safeReturnPath(path)).toBe(path);
    for(const result of [loginPath(path),onboardingPath(path)])expect(new URL(result,"https://test.invalid").searchParams.get("next")).toBe(path);
    for(const bad of ["https://evil.test","//evil.test","/.//evil.test","/%2e%2e//evil.test","/\\evil.test","/%5cevil.test","/%252fevil.test","/settings\n","/auth/login","/x/../auth/login","/api/settings/export","/%ZZ",["/settings"],null])expect(safeReturnPath(bad),String(bad)).toBeNull();
  });
  it("normalizes a trusted environment origin and has deployment fallbacks", () => {
    expect(siteOrigin({NEXT_PUBLIC_SITE_URL:"https://fitness.test/path/?x=1",VERCEL_URL:"preview.test"})).toBe("https://fitness.test");
    expect(siteOrigin({VERCEL_PROJECT_PRODUCTION_URL:"prod.test",VERCEL_URL:"preview.test"})).toBe("https://prod.test");expect(siteOrigin({VERCEL_URL:"preview.test"})).toBe("https://preview.test");expect(siteOrigin({})).toBe("http://localhost:3000");
    for(const value of ["file:///tmp/site","javascript:alert(1)","https://user:password@bad.test"])expect(()=>siteOrigin({NEXT_PUBLIC_SITE_URL:value})).toThrow();
  });
  it("keeps child canonicals and social images route-specific",()=>{const m=publicMetadata("/calculators/bmi","BMI");expect(m.alternates?.canonical).toBe("/calculators/bmi");expect(m.openGraph).toMatchObject({url:"/calculators/bmi",images:[{width:1200,height:630,url:"/og/esifit.png"}]});});
});
