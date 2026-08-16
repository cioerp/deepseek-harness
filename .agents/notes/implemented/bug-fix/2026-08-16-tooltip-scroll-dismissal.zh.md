# Agent Note: Tooltip 在滚动与锚点外按压时收起

Status: implemented

[English](2026-08-16-tooltip-scroll-dismissal.md) | 中文

## 问题

输入栏的操作按钮（发送、停止、命令）带有 hover/focus 提示气泡。气泡是 `position: fixed`，会逃出祖先裁剪，且只在 `mouseleave` 或 `blur` 时隐藏。触屏设备上轻触会合成 `mouseenter`，但永远不会触发 `mouseleave`；窄屏输入框还会在用户向上滚动时折叠为 `visibility: hidden`——于是发送消息后滚动阅读时，气泡一直悬浮在对话上方，直到下一次焦点变化。

## 决策

`Tooltip`（ui-primitives）现在会在气泡可见期间，于任何滚动事件（window，捕获阶段，passive）或落在锚点之外的指针按压时收起气泡。两处检查都直接跑在原始事件上，不与折叠输入框的 React 渲染竞态。按压锚点本身不收起（按压先于点击）。收起是一次性的、不粘滞：新的 hover 或 focus 会重新显示。

## 验证

`tooltip.client.spec.tsx` 新增：滚动收起后新 hover 重新显示、锚点外按压收起、锚点上按压保持气泡。ui-primitives 套件（501 个测试）与完整 `test:gui` 套件（3765 个测试）全过。客户端 bundle 已重建；开发 HMR 链会重新哈希并热换伺服中的 bundle。

## 考虑过的替代方案

**从输入框传入 `disabled` 属性。** 被拒绝：隐藏状态是祖先上的 CSS 属性（`data-composer-hidden`）；把它穿进 InputBar 的 slot props 会让共享的 Tooltip 耦合到输入框的折叠状态。

**当锚点的计算 `visibility` 为 hidden 时隐藏。** 被拒绝：该检查必须在 React 提交折叠类之后运行，而这会与触发折叠的滚动事件竞态。

## 后果

Tooltip 在所有输入设备上都遵循标准的收起语义（滚动 / 点击他处），修复了手机上气泡悬浮在对话上方的问题，桌面 hover 行为不变。
