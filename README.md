# Tunnel Atlas

A field guide to VPN and proxy techniques, from 1995 to 2026, with a focus on what still works under censorship.

**Live site: https://0xahp.github.io/tunnel-atlas/**

## What's inside

- **[Timeline](https://0xahp.github.io/tunnel-atlas/#timeline)**: 58 techniques, newest to oldest. Each one shows its 2026 status in Iran, China, Russia and Turkmenistan, how it connects (TCP, UDP, QUIC, DNS…), and an estimate of its battery cost on a phone.
- **[Setup guide](https://0xahp.github.io/tunnel-atlas/#setup)**: what to run in 2026 for three situations (no censorship, a censored country, a shutdown or allowlist), with a diagram of who sees what along the path.
- **[Sources](https://0xahp.github.io/tunnel-atlas/sources.html)**: every reference behind the figures, plus censorship status by country and the claims that were checked.

## Client-app benchmark

Which VLESS client app costs the least on a Mac: power, CPU, memory and wakeups, with the same traffic through the same server.

**[See the benchmark results →](https://0xahp.github.io/tunnel-atlas/#bench)**

<!-- Benchmark summary goes here after the next run. -->

## Notes

- Status reflects reports up to October 2026. Censorship changes week to week.
- Battery figures for proxy protocols are estimates; the only phone measurement covers five classic VPNs (2022).
- A static site: plain HTML, CSS and JavaScript, no build step. Refresh the benchmark copy in `bench/` with `PROXY_BENCH=/path/to/proxy-bench ./sync-bench.sh`.
