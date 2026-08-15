# Agent Note: 设置面板的局域网访问开关

Status: implemented

[English](2026-08-15-lan-access-settings-toggle.md) | 中文

## 问题

局域网暴露原本是手工操作：webserver host 以字面量写在用户的 `cordis.patch.yml` 里，靠编辑文件翻转。没有产品内开关。

## 决策

Web bundle 注册 `network.lanAccess` settings 命名空间（初值取自实际绑定）。其 `watch` 通过纯函数 `rewriteWebserverHost` 重写 profile patch 中的 webserver `host` 行（`0.0.0.0` 与 `127.0.0.1` 之间）；profile 的配置级 HMR 重新应用该行并重绑 socket，开关实时生效——与手工编辑 patch 走同一条路径。通用设置区新增一行开关，通过标准 settings scope 切换命名空间（scalar store 用 `set` 而非 `update`：Immer 草稿修改器的返回值会被丢弃）。命名空间加入 api-proxy 的 `WEB_SETTINGS_NAMESPACES` 白名单，因为仅注册并不向配置客户端开放（会报 `settings-not-exposed`）。

## 验证

单元测试覆盖 patch 重写（翻转、幂等、缺行报错）与设置行（开关提交、store 采纳）。端到端：经 loopback RPC 修改命名空间会翻转 patch、监听地址与局域网可达性，而 HTTPS 代理（转发到 loopback）持续可用。

## 考虑过的替代方案

**让 webserver host 直接读命名空间。** 被拒绝：行配置在激活时求值，设置变更不会重新求值；patch 重写复用既有 HMR 重绑，无需新增重绑路径。

## 后果

局域网暴露成为一等设置项，可在本机 loopback 浏览器操作（设置面按设计 loopback-only）。两种状态下 HTTPS 代理均不受影响。
