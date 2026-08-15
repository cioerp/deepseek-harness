# Agent Note: 无安全上下文的 RPC id 生成

Status: implemented

[English](2026-08-15-secure-context-free-rpc-ids.md) | 中文

## 问题

类型化 RPC 客户端用 `crypto.randomUUID()` 生成每个 `rpcId`，而这是浏览器仅在安全上下文（HTTPS 或 loopback）暴露的 Web API。经局域网地址上的明文 HTTP 提供服务的部署不是安全上下文，于是浏览器里每一次类型化调用——目录选择、工作区、会话——都抛 `crypto.randomUUID is not a function`。连接包自己的泛型 RPC 通道已有 `getRandomValues` 兜底，但整个 UI 实际使用的类型化 `AbstractApiClient` 路径漏掉了。

## 决策

共享生成器放在 apiproxy 的 `api` 层（`randomUuid`）：存在 `crypto.randomUUID` 时优先使用，否则回退到 `crypto.getRandomValues` 实现的 v4。fetch 客户端的 `mintRpcId` 使用它，连接包的 `client/random-uuid.ts` 复用同一实现而不是保留第二份。ui-conversation 的浏览器草稿附件 id 同样原因改用 `getRandomValues` 十六进制 id（草稿 id 只需每次草稿唯一）。

## 验证

apiproxy 的 fetch-carrier 测试新增一个用例：用缺少 `randomUUID` 的 `crypto` 桩生成 rpc id；ui-conversation 新增同桩下的草稿 id 测试。两个包套件全过。

## 考虑过的替代方案

**在每个包重复兜底。** 被拒绝：仓库的跨文件克隆门禁会标记第二个 UUID 生成器。

**apiproxy 复用连接包的现有辅助。** 被拒绝：依赖方向——连接包依赖 apiproxy。

## 后果

明文 HTTP 局域网部署可以关联 RPC；HTTPS 与 loopback 继续原样使用 `crypto.randomUUID`。UUID 实现只剩一份，位于 apiproxy 的 api 层。
