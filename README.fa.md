[English](README.md) | [简体中文](README.zh-CN.md) | فارسی

<div dir="rtl">

# Tunnel Atlas: کدام اپ پروکسی سریع‌تر است و باتری کمتری مصرف می‌کند؟

روی مک Throne و روی آیفون Egern در صدر است. ما ۲۳ کلاینت پروکسی به‌علاوهٔ خط فرمان sing-box را روی مک و ۷ اپ را روی آیفون، با ترافیکی یکسان و هر بار یک اپ، آزمایش کردیم.

**در سایت بخوانید: https://0xahp.github.io/tunnel-atlas/** (سایت به زبان انگلیسی است)

- **روی مک:** Throne اول است، با 16.9 Gbit/s و 0.29 ژول به‌ازای هر گیگابایت.
- **روی آیفون:** Egern اول است. انرژی اضافه‌ای که به‌ازای هر گیگابایت مصرف می‌کند حدود نصف Anywhere، سریع‌ترین اپ آیفون، است.
- **بر اساس انرژی انتخاب کنید:** پرمصرف‌ترین اپ مک به‌ازای هر گیگابایت ۵۵ برابر کم‌مصرف‌ترین اپ انرژی مصرف می‌کند.
- **چیدمان‌های واقعی پرهزینه‌ترند:** زنجیرهٔ دو پروکسی با قوانین مسیریابی حدود ۳ برابر یک پروکسی انرژی مصرف کرد.

## رتبه‌بندی

در امتیاز، بهره‌وری انرژی ۷۰٪ و سرعت ۳۰٪ وزن دارد، چون اپ‌های برتر از هر اتصال اینترنتی بسیار سریع‌ترند. سرور آزمایشی روی خود دستگاه اجرا می‌شود، پس نتایج فقط هزینهٔ خود اپ را نشان می‌دهد و شبکه در آن نقشی ندارد.

**مک (MacBook Air M1)**

| رتبه | اپ | امتیاز | میانگین سرعت | انرژی در ۲۰۰ Mbit/s |
|---:|---|---:|---:|---:|
| ۱ | [Throne](https://0xahp.github.io/tunnel-atlas/apps/throne.html) | 94 | 16.9 Gbit/s | 0.29 J/GB |
| ۲ | [خط فرمان sing-box](https://0xahp.github.io/tunnel-atlas/apps/sing-box-cli.html) | 82 | 16.3 Gbit/s | 0.34 J/GB |
| ۳ | [SFM](https://0xahp.github.io/tunnel-atlas/apps/sfm.html) | 81 | 9.58 Gbit/s | 0.28 J/GB |
| ۴ | [Egern](https://0xahp.github.io/tunnel-atlas/apps/egern.html) | 64 | 3.87 Gbit/s | 0.26 J/GB |
| ۵ | [Surge](https://0xahp.github.io/tunnel-atlas/apps/surge.html) | 58 | 10.2 Gbit/s | 0.46 J/GB |

**آیفون (iPhone 11 Pro)**

| رتبه | اپ | امتیاز | میانگین سرعت | انرژی اضافه در ۲۰۰ Mbit/s |
|---:|---|---:|---:|---:|
| ۱ | [Egern](https://0xahp.github.io/tunnel-atlas/apps/egern.html) | 92 | 2.46 Gbit/s | 6.2 J/GB |
| ۲ | [Anywhere](https://0xahp.github.io/tunnel-atlas/apps/anywhere.html) | 63 | 3.27 Gbit/s | 12 J/GB |
| ۳ | [Shadowrocket](https://0xahp.github.io/tunnel-atlas/apps/shadowrocket.html) | 50 | 1.16 Gbit/s | 10.8 J/GB |

[همهٔ نتایج ۲۴ اپ مک](https://0xahp.github.io/tunnel-atlas/data.html#mac) و [همهٔ نتایج ۷ اپ آیفون](https://0xahp.github.io/tunnel-atlas/data.html#iphone) را ببینید. هر اپ صفحهٔ جداگانهٔ خود را هم دارد.

## شکاف اصلی در انرژی است

سرعت به‌ندرت محدودیت است. Happ، کندترین اپ مک، باز هم میانگین 0.38 Gbit/s داشت. تفاوت اپ‌ها در انرژی است: Happ به‌ازای هر گیگابایت 14.6 ژول مصرف کرد و Egern فقط 0.26 ژول. روی آیفون همین فاصله حدود ۷ برابر است، از 6.2 تا 44.3 ژول به‌ازای هر گیگابایت.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/graph-energy-dark.svg">
  <img width="100%" alt="انرژی به‌ازای هر گیگابایت روی مک در ۲۰۰ Mbit/s بر حسب ژول: Egern 0.26، Throne 0.29، Surge 0.46، Shadowrocket 0.54، Anywhere 0.75، V2Box 7.52، Streisand 12.76، Happ 14.58." src="assets/graph-energy-light.svg">
</picture>

## استفادهٔ واقعی پرهزینه‌تر است

روی مک و از طریق سرورهای واقعی در اینترنت، در ۲۰۰ Mbit/s توان مصرفی Egern 7.6 میلی‌وات، Anywhere 23.7 و Shadowrocket 33.7 بود. افزودن پروکسی دوم و قوانین مسیریابی روزمره این عدد را برای Egern و Shadowrocket تقریباً سه برابر کرد.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/graph-chain-dark.svg">
  <img width="100%" alt="توان مصرفی اپ روی مک در ۲۰۰ Mbit/s از طریق سرورهای واقعی، یک پروکسی در برابر زنجیرهٔ دو پروکسی با قوانین مسیریابی: Egern از 7.6 به 23.3 میلی‌وات، Shadowrocket از 33.7 به 100.4 و Anywhere از 23.7 به 103.6." src="assets/graph-chain-light.svg">
</picture>

## MTU خود را بررسی کنید

MTU اندازهٔ بسته‌های تونل است. با مقدار رایج 1500، هر اپ به‌ازای هر گیگابایت حدود 2.7 برابر بیشتر از 4000 بسته پردازش می‌کند. بالا بردن آن از 1500 به 4000 سرعت آپلود SFM را از 10.8 به حدود 14.3 Gbit/s رساند. روی مک، هر هفت اپی که MTU آن‌ها 1500 یا کمتر است در میان نُه اپ کندتر قرار دارند، پس هر جا اپ اجازه می‌دهد آن را 4000 بگذارید.

## در ۲۰۲۶ از چه استفاده کنیم

- **بدون سانسور:** از WireGuard استفاده کنید.
- **کشوری با سانسور:** با VLESS + REALITY روی دامنهٔ خودتان شروع کنید و Hysteria2 را برای پشتیبان نگه دارید.
- **قطعی اینترنت یا لیست سفید:** از یک رله در داخل کشور استفاده کنید.

در [Routes (مسیرها)](https://0xahp.github.io/tunnel-atlas/routes.html) هر چیدمان، مسیر آن و این‌که در طول مسیر چه کسی چه چیزی را می‌بیند آمده است.

## بخش‌های دیگر سایت

- **[Timeline (خط زمانی)](https://0xahp.github.io/tunnel-atlas/timeline.html):** سی سال تونل‌های VPN و پروکسی، و این‌که در ۲۰۲۶ در ایران، چین، روسیه و ترکمنستان چه چیزی کار می‌کند.
- **[All the numbers (همهٔ اعداد)](https://0xahp.github.io/tunnel-atlas/data.html):** جدول‌های مرتب‌شدنی برای همهٔ اپ‌ها، همهٔ مسیرها، سانسور به تفکیک کشور و هر ۵۸ تکنیک.
- **[Sources and method (منابع و روش)](https://0xahp.github.io/tunnel-atlas/sources.html):** روش کامل، محدودیت‌ها، ۳۷ ادعای بررسی‌شده و همهٔ منابع.

## روش آزمون

یک MacBook Air M1 و یک iPhone 11 Pro هر اپ را به‌نوبت با یک پروفایل یکسان Shadowsocks 2022 اجرا کردند: دو دور روی مک و سه دور روی آیفون. سرعت هر اپ با ۱ و ۴ اتصال و انرژی آن هنگام دانلود پیوسته با ۲۰۰ Mbit/s اندازه‌گیری شد. استثناها در [روش کامل](https://0xahp.github.io/tunnel-atlas/sources.html#method) آمده و نتایج خام در [`bench/experiments.json`](bench/experiments.json) است.

این‌ها نتایج یک مک و یک آیفون با نسخه‌های نصب‌شده در ۲۰ تا ۲۲ اکتبر ۲۰۲۶ است و نتیجهٔ شما به دستگاه، سیستم‌عامل و نسخهٔ اپ بستگی دارد. وضعیت سانسور بیشتر بر پایهٔ گزارش‌های کاربران تا اکتبر ۲۰۲۶ است و هر هفته تغییر می‌کند.

<sub>آزمونی مستقل و غیرتجاری.</sub>

</div>
