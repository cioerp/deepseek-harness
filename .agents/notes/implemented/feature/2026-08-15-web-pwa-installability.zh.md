# Agent Note: 可安装 PWA（图标、清单、直通 Service Worker）

Status: implemented

[English](2026-08-15-web-pwa-installability.md) | 中文

## 问题

Web GUI 的清单只有 SVG 图标且没有 Service Worker，移动浏览器无法把它安装为应用；iOS 只能回退成截图图标。

## 决策

新增 PNG 应用图标（192/512 + maskable + apple-touch-icon）、补全清单（主题/背景色），并注册直通式 Service Worker。该 Worker 只处理静态 GET：`/api/*` 与所有非 GET 完全绕开，因为拦截一切请求的 fetch-through SW 会成为故障点——经它转发的 POST RPC 会以网络错误失败，静默破坏 GUI 的实时流量。

## 验证

构建后的前端提供新资产；dist 中的 sw.js 排除 /api。浏览器冒烟：启用 Worker 时 GUI 功能正常。

## 考虑过的替代方案

**缓存优先 Worker。** 被拒绝：bundle 带内容哈希 rev、会话实时流式，缓存只会提供陈旧代码。

## 后果

GUI 可在 Android Chrome 与 iOS 主屏幕安装。Service Worker 对所有 API 流量是空操作，不会回归 harness。
