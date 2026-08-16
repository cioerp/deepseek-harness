# Agent Note: Web 服务器可配置的 keep-alive 超时

Status: implemented

[English](2026-08-16-webserver-keepalive-timeout.md) | 中文

## 问题

Node http 服务器的默认 `keepAliveTimeout` 为 5000ms：响应结束后，5 秒内没有收到新请求的 socket 会被服务器销毁。浏览器按源持有池化连接，下一次操作时复用其中一个；当这个操作恰好落在销毁前后，请求会打到已死的 socket 上，fetch 失败（远端局域网客户端报 `failed to fetch`），直到新 socket 出现才恢复。这个销毁/复用竞态就是文档化的 nodejs/node#27379 隐患，本部署在直连 `http://<lan-ip>:3080` 路径以及（代理侧修复之前的）8443 TLS 代理路径上都踩到了。

## 决策

webserver 插件（`@deepseek-ai/dsh-host-webserver`）新增校验过的 `keepAliveTimeout` 配置项（毫秒；默认 60000；0 表示禁用超时），在创建 `node:http` 服务器时应用。60 秒默认值把竞态窗口比 Node 默认缩小 12 倍；部署可通过 `cordis.patch.yml` 的 webserver 行调整或禁用。

## 验证

对运行中的 GUI 做裸 socket 探测，确认服务器在空闲约 6 秒后关闭 keep-alive 连接（5 秒超时加请求处理耗时）。webserver 的 REAL-composition 测试新增两个用例：默认启动返回 `Keep-Alive: timeout=60` 响应头，配置 15000 则返回 `timeout=15`。webserver 全量套件通过。

## 考虑过的替代方案

**保留 Node 的 5 秒默认，只调部署。** 被拒绝：每个部署都会踩同一个竞态；更合理的默认值才能修掉这一类失败。

**在代码里无条件设置该选项。** 被仓库规则拒绝：部署期可变的选项应是校验过的 Config 字段，而不是硬编码的可调项。

## 后果

远端浏览器的 keep-alive 连接最长可空闲 60 秒而不是 5 秒，销毁/复用竞态从常见变为罕见。新配置键已写入生成的配置目录与包 README。
