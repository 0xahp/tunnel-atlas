[English](README.md) | 简体中文 | [فارسی](README.fa.md)

# Tunnel Atlas：哪款代理应用最快、最省电？

Mac 上 Throne 排名第一，iPhone 上 Egern 排名第一。我们在 Mac 上测试了 23 款代理客户端加 sing-box 命令行，在 iPhone 上测试了 7 款应用，流量完全相同，每次只运行一款。

**在网站上阅读：https://0xahp.github.io/tunnel-atlas/** （网站为英文）

- **Mac：** Throne 排名第一，16.9 Gbit/s，每 GB 0.29 焦耳。
- **iPhone：** Egern 排名第一。它每 GB 增加的能耗约为 Anywhere（iPhone 上最快的应用）的一半。
- **按能耗选择：** Mac 上最耗电的应用，每 GB 能耗是最省电应用的 55 倍。
- **实际配置更耗电：** 两层链式代理加分流规则的能耗约为单个代理的 3 倍。

## 排名

评分中能效占 70%，速度占 30%，因为排名靠前的应用已经远远快于任何互联网连接。实验室把测试服务器放在设备本身，所以结果只反映应用自身的开销，不含网络因素。

**Mac（MacBook Air M1）**

| 排名 | 应用 | 得分 | 平均速度 | 200 Mbit/s 下的能耗 |
|---:|---|---:|---:|---:|
| 1 | [Throne](https://0xahp.github.io/tunnel-atlas/apps/throne.html) | 94 | 16.9 Gbit/s | 0.29 J/GB |
| 2 | [sing-box 命令行](https://0xahp.github.io/tunnel-atlas/apps/sing-box-cli.html) | 82 | 16.3 Gbit/s | 0.34 J/GB |
| 3 | [SFM](https://0xahp.github.io/tunnel-atlas/apps/sfm.html) | 81 | 9.58 Gbit/s | 0.28 J/GB |
| 4 | [Egern](https://0xahp.github.io/tunnel-atlas/apps/egern.html) | 64 | 3.87 Gbit/s | 0.26 J/GB |
| 5 | [Surge](https://0xahp.github.io/tunnel-atlas/apps/surge.html) | 58 | 10.2 Gbit/s | 0.46 J/GB |

**iPhone（iPhone 11 Pro）**

| 排名 | 应用 | 得分 | 平均速度 | 200 Mbit/s 下的额外能耗 |
|---:|---|---:|---:|---:|
| 1 | [Egern](https://0xahp.github.io/tunnel-atlas/apps/egern.html) | 92 | 2.46 Gbit/s | 6.2 J/GB |
| 2 | [Anywhere](https://0xahp.github.io/tunnel-atlas/apps/anywhere.html) | 63 | 3.27 Gbit/s | 12 J/GB |
| 3 | [Shadowrocket](https://0xahp.github.io/tunnel-atlas/apps/shadowrocket.html) | 50 | 1.16 Gbit/s | 10.8 J/GB |

查看 [Mac 全部 24 款结果](https://0xahp.github.io/tunnel-atlas/data.html#mac) 和 [iPhone 全部 7 款结果](https://0xahp.github.io/tunnel-atlas/data.html#iphone)。每款应用都有单独的页面。

## 真正的差距在能耗

速度很少成为限制。Mac 上最慢的 Happ 平均也有 0.38 Gbit/s。应用之间的差别在能耗：Happ 每 GB 用 14.6 焦耳，Egern 只用 0.26 焦耳。在 iPhone 上，同样的差距约为 7 倍，从 6.2 到 44.3 J/GB。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/graph-energy-dark.svg">
  <img width="100%" alt="Mac 在 200 Mbit/s 下每 GB 能耗（焦耳）：Egern 0.26、Throne 0.29、Surge 0.46、Shadowrocket 0.54、Anywhere 0.75、V2Box 7.52、Streisand 12.76、Happ 14.58。" src="assets/graph-energy-light.svg">
</picture>

## 实际使用更耗电

在 Mac 上经由互联网上的真实服务器，200 Mbit/s 时 Egern 功耗为 7.6 mW，Anywhere 为 23.7，Shadowrocket 为 33.7。加上第二层代理和日常分流规则后，Egern 和 Shadowrocket 的功耗大约变为三倍。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/graph-chain-dark.svg">
  <img width="100%" alt="Mac 上经由真实服务器、200 Mbit/s 时的应用功耗，单个代理对比两层链式代理加分流规则：Egern 从 7.6 到 23.3 mW，Shadowrocket 从 33.7 到 100.4 mW，Anywhere 从 23.7 到 103.6 mW。" src="assets/graph-chain-light.svg">
</picture>

## 检查你的 MTU

MTU 是隧道数据包的大小。在常见的 1500 下，应用每 GB 要处理的数据包约为 4000 时的 2.7 倍。把 MTU 从 1500 提高到 4000，SFM 的上传速度从 10.8 提升到约 14.3 Gbit/s。在 Mac 上，MTU 为 1500 或更低的 7 款应用全部位列最慢的 9 款之中，所以只要应用允许，就设为 4000。

## 2026 年该用什么

- **无审查：** 用 WireGuard。
- **受审查国家：** 先用自有域名上的 VLESS + REALITY，并保留 Hysteria2 作为备用。
- **断网或白名单：** 使用境内中继。

[Routes（线路方案）](https://0xahp.github.io/tunnel-atlas/routes.html) 列出了每种方案、它走的路径，以及沿途谁能看到什么。

## 网站上还有

- **[Timeline（时间线）](https://0xahp.github.io/tunnel-atlas/timeline.html)：** VPN 与代理隧道的三十年，以及 2026 年在伊朗、中国、俄罗斯和土库曼斯坦什么还能用。
- **[All the numbers（全部数据）](https://0xahp.github.io/tunnel-atlas/data.html)：** 可排序的表格，涵盖每款应用、每条线路、各国审查状况和全部 58 种技术。
- **[Sources and method（来源与方法）](https://0xahp.github.io/tunnel-atlas/sources.html)：** 完整方法、局限、37 条经过核实的说法和全部参考资料。

## 测试方法

MacBook Air M1 和 iPhone 11 Pro 依次运行每款应用，使用相同的 Shadowsocks 2022 配置：Mac 上两轮，iPhone 上三轮。每款应用都测试了 1 条和 4 条连接下的速度，以及稳定 200 Mbit/s 下载时的能耗。例外情况见[完整方法](https://0xahp.github.io/tunnel-atlas/sources.html#method)，原始结果在 [`bench/experiments.json`](bench/experiments.json)。

这些结果来自一台 Mac 和一部 iPhone，版本为 2026 年 10 月 20–22 日安装的版本，你的结果取决于设备、系统和应用版本。审查状况主要来自截至 2026 年 10 月的用户报告，每周都可能变化。

<sub>独立、非商业测试。</sub>
