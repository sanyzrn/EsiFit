# EsiFit — اکوسیستم تناسب اندام فارسی

**وضعیت:** Next.js 16 / React 19 / Prisma + PostgreSQL (Supabase) / RTL-first PWA. طراحی داخلی مینیمال و فلت (زغالی + نارنجی) با نوار ناوبری موبایل بدون شیشه، سایه و گلو. هیروی کمپینی صفحه اول جداگانه طراحی شده و محفوظ است.

**انتشار:** به‌منظور صرفه‌جویی در سهمیه Vercel، انتشار خودکار غیرفعال است؛ هر Push یا Merge فقط GitHub CI را اجرا می‌کند. راهنما: [راهنمای انتشار دستی](docs/DEPLOYMENT_WORKFLOW.md).

اپلیکیشن PWA جامع تناسب اندام فارسی (RTL-first): تمرین زنده آفلاین‌پسند، آناتومی تعاملی عضلات، تغذیه با غذاهای ایرانی، امتیاز آمادگی روزانه، اهداف و موتور تشخیص ثبات (پلاتو)، مربی تطبیقی، جایگزینی هوشمند حرکات، جمع‌بندی هوشمند هفتگی، تحلیل پیشرفت با «امتیاز اسی»، گیمیفیکیشن، انجمن، فروشگاه، اشتراک و دستیار هوشمند.

## نقش‌ها (سه اکوی واقعی محصول)

| نقش | حساب دمو | دسترسی |
|---|---|---|
| ورزشکار (Athlete/Member) | `09120000000` (وی‌آی‌پی، ۹۰ روز تاریخچه) | داشبورد، تمرین زنده، تغذیه، تحلیل، اهداف، دستاوردها، … |
| مربی (Coach) | `09130000000` | «ورزشکاران من»: فهرست با هشدارهای مربیگری، پرونده ورزشکار (نمودارها، رکوردها، اهداف، درد فعال)، تجویز برنامه |
| مدیر (Admin) | `09140000000` | «کنسول مدیریت»: سنجه‌های سیستم، مدیریت کاربران (نقش/اشتراک/وضعیت)، مدیریت محتوا (حذف پست/دیدگاه) |

**سه مفهوم مستقل:** نقش حساب (`admin`/`coach`/`member`)، اشتراک ورزشکار (`free`/`vip`/`vip_plus`) و سطح تمرینی (مبتدی/متوسط/پیشرفته). مجوزها در API بررسی می‌شوند، نه صرفاً منو. ادمین فقط مدیریت سایت می‌کند و برنامه ورزشی شخصی ندارد؛ مربی فقط اعضای مرتبط با خودش را می‌بیند. [مدل دسترسی](docs/ACCESS_CONTROL_MODEL.md).

### ورود با حساب‌های دمو

هیچ پیامک واقعی ارسال نمی‌شود (`SMS_PROVIDER=dev`). کد ورود بسته به حالت اجرا از دو راه به دست می‌آید:

| حالت اجرا | کد OTP کجاست؟ |
|---|---|
| `bun run dev` | هم در لاگ سرور، هم **مستقیماً روی خود صفحه ورود** نمایش داده می‌شود |
| `bun run start` (production) | **فقط** در لاگ سرور: `[sms:dev] OTP for 09120000000: ۱۲۳۴۵۶` |

در حالت production کد عمداً در پاسخ API برگردانده نمی‌شود؛ اگر با `bun run start` کار می‌کنید کد را از
خروجی ترمینال (یا `server.log`) بردارید. ساده‌ترین راه برای دیدن دموی کامل، `bun run dev` است.

نکته: بعد از هر درخواست کد، ۶۰ ثانیه محدودیت ارسال مجدد فعال است و هر کد ۲ دقیقه اعتبار دارد.

پیش‌نیاز: حساب‌های دمو فقط بعد از اجرای `bun scripts/seed.ts` وجود دارند.

## اجرای سریع

```bash
# 1) نصب وابستگی‌ها
bun install

# 2) ساخت دو دیتابیس روی Postgres محلی (دومی مخصوص تست‌هاست)
createdb esifit
createdb esifit_test

# 3) پیکربندی محیط
cp .env.example .env        # DATABASE_URL را با یوزر/پسورد Postgres خودتان پر کنید

# 4) ساخت جدول‌ها + داده اولیه (deterministic seed)
bun run db:push
bun run db:seed

# 5) اجرا
bun run dev                 # http://localhost:3000
```

سپس با یکی از حساب‌های دمو وارد شوید (`09120000000` / `09130000000` / `09140000000`).
در `bun run dev` کد OTP مستقیماً روی صفحه‌ی ورود نشان داده می‌شود.

## تست‌ها و کیفیت

```bash
bun run test        # اجرای کامل تست‌های واحد و API (تعداد تست‌ها وابسته به نسخه است)
bun run lint        # ESLint
bunx tsc --noEmit   # تایپ‌چک کامل (strict)
```

پوشش تست‌ها: احراز هویت OTP (نرمال‌سازی شماره، هش کد، خروج)، گارد نقش‌ها (401/403، ایزولاسیون فهرست مربی، گاردریل‌های ادمین)، جریان تمرین (ساخت جلسه، sync آفلاین idempotent با clientId، تشخیص رکورد + demote رکورد قبلی + XP یک‌بارمصرف)، ماشین‌حساب‌ها (ذخیره scoped)، اهداف (پیشرفت واقعی + مالکیت)، درد و جایگزینی (گیت سخت درد، جلوگیری از جایگزینی با ست ثبت‌شده)، جمع‌بندی هفتگی (entitlement)، و موتورهای دامنه (BMI/1RM/ماکرو/readiness/اهداف/پلاتو/مربی تطبیقی/امتیاز اسی).

## پیکربندی محیط (.env)

| متغیر | توضیح |
|---|---|
| `DATABASE_URL` | رشته اتصال Postgres — `postgresql://user:pass@host:5432/db` |
| `TEST_DATABASE_URL` | دیتابیس جدا برای تست‌ها (بین تست‌ها پاک می‌شود — هرگز دیتابیس اصلی نباشد) |
| `SESSION_SECRET` | کلید امضای سشن‌ها — **در تولید الزامی**؛ بدون آن سرور از ساخت/بررسی سشن سر باز می‌زند (fail-closed) |
| `NEXT_PUBLIC_SITE_URL` | دامنه عمومی؛ مبنای canonical، `og:url`، `robots.txt` و `sitemap.xml` |
| `SMS_PROVIDER` | `dev` (پیش‌فرض) \| `kavenegar` \| `melipayamak` \| `smsir` |
| `KAVENEGAR_API_KEY` / `KAVENEGAR_SENDER` | اعتبار کاوه‌نگار |
| `MELIPAYAMAK_USERNAME` / `MELIPAYAMAK_PASSWORD` / `MELIPAYAMAK_FROM` | اعتبار ملی‌پیامک |
| `SMSIR_API_KEY` / `SMSIR_LINE` / `SMSIR_OTP_TEMPLATE_ID` | اعتبار SMS.ir |
| `ESIFIT_FLAG_<NAME>` | override فلگ‌ها؛ مثال: `ESIFIT_FLAG_AI_CHAT=off` |

دروازه پرداخت و اعتبار SMS عمداً adapter-ready نگه داشته شده‌اند (بدون کلید واقعی).

## معماری (خلاصه)

- **فریم‌ورک:** Next.js 16 App Router + React 19 + TypeScript strict
- **استایل:** Tailwind CSS 4 + پالت زغالی `#0B0D10` / نارنجی `#F97316` و لایت خنثی، پاریتی dark/light؛ کارت‌های تخت و خطوط مرزی به‌جای شیشه/سایه/نور؛ لوگوی هندسی ختم حفظ شده
- **فونت:** Vazirmatn (متن رابط) + Lalezar (تیترها و اعداد درشت)، هر دو self-hosted
- **داده:** Prisma + PostgreSQL؛ مرز ریپازیتوری حفظ شده
- **احراز هویت:** اول‌حساب موبایل+OTP؛ آداپتور پیامک ایرانی؛ سشن opaque + JWT در کوکی httpOnly؛ rate-limit و انقضای کد
- **نقش‌ها:** `member | coach | admin` با گارد سرور، مالکیت داده و ارتباط ‌`CoachClient`؛ کنسول ادمین تعیین مربی و مدیریت کاربران/محتوا را انجام می‌دهد
- **حقوق دسترسی:** اشتراک صرفاً برای ورزشکار (`free`/`vip`/`vip_plus`) و هیچ‌گاه مجوز مربی یا ادمین نیست؛ مربی AI فقط گزینه رزرو، بدون موتور اجرایی و بدون حساب ورود
- **آفلاین:** صف IndexedDB با clientId پایدار، sync idempotent، هرگز تمرین فعال از دست نمی‌رود
- **رابط کاربری:** فضای داخلی ساده و فلت، کارت‌های بدون سایه، کنترل‌های ۴۴ پیکسلی برای موبایل و نوار ناوبری ثابت لبه‌به‌لبه؛ انیمیشن‌های نمایشی/گلو حذف شده‌اند، رفتارهای عملکردی باقی مانده‌اند
- **آیکن‌ها:** `node scripts/generate-icons.mjs` از روی یک طرح برداری همه آیکن‌های PWA را بازمی‌سازد
- **آناتومی:** پکیج رسمی [`react-muscle-highlighter`](https://github.com/soroojshehryar/react-muscle-highlighter) (MIT، نسخه ثابت ۱٫۲٫۰) هندسه کامل بدن (۴ مدل، همه نواحی + سر/مو/دست/پا و خط دور بدن) را می‌دهد؛ `components/data-viz/anatomy/muscle-body.tsx` فقط رنگ تم، انتخاب/درد، هاور و انیمیشن را روی آن می‌گذارد


## داشبورد و تجربه جدید رابط کاربری

- **داشبورد ورزشکار:** ترتیب روشن «امروز → آمادگی → تغذیه و آب → اهداف و وزن»، با تمرین در جایگاه اول. داده‌های صفر، آفلاین و حالت بارگذاری پیام مشخص دارند؛ ثبت آب و شروع/ادامه تمرین همچنان از API و صف آفلاین قبلی استفاده می‌کند.
- **ناوبری موبایل:** تخت، بدون شیشه، سایه، رنگ نورانی یا آیکون شناور؛ حداکثر پنج مقصد، با خط رنگی برای آیتم فعال. ناوبری نقش‌های مربی و مدیر مستقل است.
- **رابط عمومی:** کارت‌ها و کنترل‌های مشترک فلت شده‌اند؛ هیروی کمپینی «هر روز، قوی‌تر از دیروز» که جداگانه طراحی شده حفظ شده است.
- **کنسول ادمین:** مدیریت مربی‌ها، ورزشکاران، نقش و اشتراک، نظارت محتوا. AI coach فقط رزرو است، نه مربی واقعی و نه حساب لاگین. [جزئیات](docs/ADMIN_CONSOLE_PHASES_2_3.md).
- **یکپارچگی طراحی:** [راهنمای فلت EsiFit](docs/FLAT_UI_DESIGN.md) و [رنگ‌ها/هیروی کمپینی](docs/LANDING_HERO_ART_DIRECTION.md).

## قابلیت‌های کلیدی

- **تمرین زنده:** ثبت ست در ۳ ثانیه، تایمر استراحت، RPE، ثبت صوتی، جایگزینی هوشمند حرکت (با احترام به درد فعال)، افزودن حرکت به جلسه آزاد، همگام‌سازی مطمئن آفلاین
- **رکوردهای شخصی:** تشخیص خودکار (مدل Epley/Brzycki)، تاریخچه رکوردها با نمودار روند
- **اهداف:** پیشرفت واقعی از داده (وزن، فرکانس، قدرت، حجم، نظم تغذیه) + برآورد زمان رسیدن
- **تشخیص ثبات:** سکوت قدرت، رکود حجم، افت پیوستگی + بینش‌های مثبت روند
- **مربی تطبیقی:** تنظیم حجم امروز بر اساس آمادگی، RPE اخیر، وقفه و پلاتو
- **جمع‌بندی هفتگی:** روایت قاعده‌محور از داده واقعی + بازنویسی هوشمند (وی‌آی‌پی+)
- **امتیاز اسی:** شاخص ترکیبی توضیح‌پذیر (پیوستگی/قدرت/حجم/ریکاوری/تغذیه)
- **پیش‌پر شدن از دفعه قبل:** هر حرکت با وزن/تکرار پیشنهادی امروز (پیشرفت دوگانه) باز می‌شود؛ ماشین‌حساب صفحه‌های هالتر، پیشنهاد گرم‌کردن و گام افزایش متناسب با تجهیزات
- **تعادل ساختاری و ریکاوری:** نسبت ست‌های هفتگی فشار/کشش، جلو/پشت ران و شانه‌ها + نقشه ریکاوری عضلات
- **جستجوی فارسی‌محور حرکات:** یکسان‌سازی ی/ک/نیم‌فاصله/ارقام، تحمل یک غلط تایپی و اختصارهای باشگاهی (dl، ohp، rdl…)
- **آناتومی تعاملی:** انتخاب عضله با انیمیشن، فیلتر کتابخانه حرکات، نقشه حرارتی حجم ۳۰ روز

## انتشار کنترل‌شده

**نکته Build:** دستور `npm run build` ابتدا `prisma generate` را اجرا می‌کند تا مدل‌های دیتابیس (از جمله مربی AI) در محیط مستقل Vercel نیز موجود باشند. موفقیت CI تنها وقتی قابل اتکا برای انتشار است که همین مرحله در Build پلتفرم هم اجرا شود.



`vercel.json` با `git.deploymentEnabled: false` مانع Deployment خودکار Push و Merge می‌شود؛ GitHub Actions Build و تست‌ها را همچنان اجرا می‌کند. پس از تجمیع تغییرات، یک انتشار Production از **آخرین SHA شاخه `main`** در پنل Vercel بسازید (نه Redeploy یک نسخه قدیمی). تا زمانی که وضعیت READY و SHA همسان نشده، وب‌سایت نسخه قبلی را نمایش می‌دهد. [راهنمای دقیق](docs/DEPLOYMENT_WORKFLOW.md).

## نکات تولید

- جابه‌جایی به Supabase یا هر Postgres مدیریت‌شده: فقط `DATABASE_URL` عوض می‌شود
- اپ به یک پروسه‌ی زنده‌ی Node نیاز دارد (رندر سمت سرور + روت‌های API)؛ روی هاست استاتیک/PHP اجرا نمی‌شود
- `SESSION_SECRET` تصادفی الزامی است. اگر تنظیم نشده باشد، در تولید سرور به‌جای استفاده از کلید توسعه
  **خطا برمی‌گرداند** و یک پیام `FATAL` در لاگ می‌نویسد (صفحه‌های عمومی همچنان سرو می‌شوند).
  تولید کلید: `openssl rand -hex 32`
- `NEXT_PUBLIC_SITE_URL` را روی دامنه واقعی بگذارید؛ در نبود آن canonicalها و sitemap روی
  ابتدا دامنهٔ اصلی و سپس دامنهٔ استقرار Vercel بررسی می‌شود؛ در محیط محلی `http://localhost:3000` است.
- خروجی `standalone` به‌صورت پیش‌فرض فایل `.env` محلی را هم کپی می‌کند و آن مقادیر بر متغیرهای
  محیطیِ پلتفرم غالب می‌شوند؛ اسکریپت `build` این فایل‌ها را از خروجی حذف می‌کند تا کلیدهای
  توسعه به تولید نشت نکنند. متغیرها را از خود پلتفرم تزریق کنید.
- پرداخت واقعی: جایگاه آداپتور در `api/plans/subscribe` آماده است. **توجه:** مسیر فعلی یک پرداخت
  آزمایشی است و tier را بدون تراکنش واقعی ارتقا می‌دهد؛ پیش از انتشار عمومی باید به دروازه واقعی وصل شود.
  در production این مسیر **قفل** است مگر `ALLOW_MOCK_PAYMENT=true` (پیش‌فرض: غیرفعال).
- SMS واقعی: اعتبارها را در `.env` قرار دهید و `SMS_PROVIDER` را تغییر دهید.
  در production اگر `SMS_PROVIDER=dev` یا خالی باشد، سرور **fail-closed** خطا می‌دهد (کد OTP هرگز به لاگ نمی‌رود).

## یادداشت‌های آمادگی تولید (نیازمند تصمیم/اعتبار واقعی)

| یکپارچگی | وضعیت فعلی | برای انتشار چه لازم است |
|---|---|---|
| **دروازه پرداخت** | sandbox — upgrade بدون تراکنش؛ production غیرفعال مگر فلگ | اتصال به زرین‌پال/آیدی‌پی/سداد + callback verification + ایجاد `Subscription` فقط پس از تأیید مبلغ |
| **SMS** | `dev` چاپ در لاگ؛ آداپتورهای kavenegar/melipayamak/smsir آماده | تنظیم `SMS_PROVIDER` + کلیدها؛ تست deliverability و قالب پیامک فارسی |
| **آمار/سایت‌مپ** | از `NEXT_PUBLIC_SITE_URL` ساخته می‌شود | ست کردن دامنه واقعی قبل از crawl |
| **SESSION_SECRET** | fail-closed در production | `openssl rand -hex 32` در متغیرهای پلتفرم |
| **Rate-limit چندنمونه‌ای** | in-process (تک‌نمونه) | Redis/Upstash برای scale-out |
| **امنیت هدرها** | X-Content-Type-Options / X-Frame-Options / Referrer-Policy / Permissions-Policy | افزودن HSTS + CSP سخت‌گیرانه در reverse proxy یا next.config پس از پایداری assetها |
| **حذف حساب / پرداخت واقعی فروشگاه** | پیام دمو | API حذف/آرشیو حساب + درگاه فروشگاه جدا از اشتراک |

## Audit hardening and remaining product boundaries

CI runs the complete unit/API suite and a dependency audit including development tooling. Node 22.19+ (22 LTS) or 24+ is required; Bun 1.3.4+ remains optional for seed tasks. `db:push` no longer includes `--accept-data-loss`; deliberate destructive resets belong only to disposable test databases.

The repository has not selected an application open-source license. No MIT/Apache grant is implied; third-party asset licenses and attribution remain in their existing documents. Web Push is not implemented: notifications are in-app only. A future push system needs explicit opt-in, subscription revocation, VAPID configuration, permission UX and delivery testing. Real payments/refunds, account erasure and competition scoring remain unavailable; do not market those as shipped.

Exercise illustrations: [Exercise data by RepDB (repdb.co)](https://repdb.co), used under its [free-tier in-app license](https://github.com/RepDB/exercise-dataset/blob/main/LICENSE-DATA.md). Four separately labeled SVG key-pose schematics are original EsiFit assets. Added food references use [USDA FoodData Central](https://fdc.nal.usda.gov/) record IDs; see docs/COACH_CATALOG_ENGAGEMENT.md.
