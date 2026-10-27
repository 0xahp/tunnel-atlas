[English](README.md) | 简体中文 | [فارسی](README.fa.md)

# Tunnel Atlas

**哪款代理客户端最快、最省电？** 在 Mac 上测试了 24 款应用，在 iPhone 上测试了 7 款（2026 年 10 月），另附一份 VPN 与代理协议指南。

**网站：https://0xahp.github.io/tunnel-atlas/** （网站为英文）

## 代理客户端性能测试

每款应用依次单独运行，将相同的流量通过隧道发往同一台设备上的 Shadowsocks 2022 测试服务器。中间没有网络干扰，因此结果反映的是每款应用自身的速度和能耗。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/lab-speed-dark.svg">
  <img width="49%" alt="Mac 实验室吞吐量，前 7 名，平均 Gbit/s：Throne 16.9、sing-box CLI 16.3、Koala Clash 10.6、FlClash 10.5、Surge 10.2、Hiddify 9.6、SFM 9.6。" src="assets/lab-speed-light.svg">
</picture>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/lab-energy-dark.svg">
  <img width="49%" alt="Mac 实验室在 200 Mbit/s 下每 GB 能耗，前 7 名，单位焦耳：Egern 0.26、SFM 0.28、Throne 0.29、sing-box CLI 0.34、Surge 0.46、Shadowrocket 0.54、Hiddify 0.57。" src="assets/lab-energy-light.svg">
</picture>

*Mac 实验室（MacBook Air M1，2 轮）。能耗采用 macOS 自身给出的各应用隧道进程数据。综合排名中速度占 30%，能效占 70%。*

- **Mac 实验室**（MacBook Air M1，macOS 27；其中 3 款应用在 macOS 26.7 上测试）：23 款应用加上 sing-box 命令行，共 2 轮。Throne、sing-box 命令行和 SFM 得分最高；Egern 每 GB 能耗最低。
- **iPhone 实验室**（iPhone 11 Pro，iOS 27）：7 款应用，3 轮（sing-box 为 1 轮，10 月 22 日加入），测试期间无人操作手机。Egern 能效领先；Anywhere 速度最快。
- **MTU 对结果影响很大：** 在常见的 1500 下，应用每 GB 要处理的数据包约为 4000 时的 2.7 倍。在我们的测试中，把 MTU 从 1500 提高到 4000，SFM 的上传速度从 10.8 提升到约 14.3 Gbit/s（1.3 倍），Karing 的速度从 0.9 提升到 2.4 Gbit/s（2.5 倍，同时也更换了协议栈）。在 Mac 上，MTU 为 1500 或更低的 7 款应用全部位列最慢的 9 款之中。
- **实际使用耗电更多：** 在早前一次经由真实服务器的测试中，两层链式代理加分流规则的每 GB 能耗约为单个代理的 3 倍。

**[查看全部指标 →](https://0xahp.github.io/tunnel-atlas/#bench)** 1 条和 4 条连接下的速度，200 Mbit/s 下的能耗、CPU 和内存，iPhone 上的待机消耗，以及每款应用的内部构成。

<sub>独立、非商业测试，仅使用一台 Mac 和一部 iPhone。结果取决于设备、系统版本和应用版本。</sub>

## 网站上还有

- **[Routes（线路方案）](https://0xahp.github.io/tunnel-atlas/#setup)**：2026 年针对三种情况的最佳方案（无审查、受审查国家、断网或白名单），并附图说明路径上的每一方能看到什么。
- **[Timeline（时间线）](https://0xahp.github.io/tunnel-atlas/#timeline)**：58 种 VPN 与代理技术，从新到旧排列，每种都标注了 2026 年在伊朗、中国、俄罗斯和土库曼斯坦的可用状态、连接方式，以及在手机上的耗电估算。
- **[Sources（资料来源）](https://0xahp.github.io/tunnel-atlas/sources.html)**：所有数据背后的参考资料，以及各国审查状况和经过核实的说法。

## 说明

- 结果可能随应用更新而变化；网站上列出了所测试的版本。
- 审查状况反映截至 2026 年 10 月的报告，每周都可能变化。
- 时间线中代理协议的耗电数据为估算值；唯一的手机实测只涵盖五种传统 VPN（2022 年）。
- 纯静态网站：HTML、CSS 和 JavaScript，无需构建步骤。
