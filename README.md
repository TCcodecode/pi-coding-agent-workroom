# PI Desk

[pi-coding-agent](https://github.com/earendil-works/pi) 的桌面客户端 — 用 Electron + React 给 pi Agent 内核套上一个原生 GUI。

## 功能

- **会话工作台**:项目侧边栏、多会话管理、会话树、fork / clone / 导入导出、会话重命名与删除
- **多会话 Tab(working set)**:顶部 Tab 条管理打开中的会话,固定/关闭/切换,`⌘W` 关 Tab 而非退应用;右键菜单支持关闭其他 / 关闭右侧;Tab 状态点实时反映运行中 / 等待输入 / 错误
- **Timeline 对话流**:Markdown 渲染(GFM)、thinking + 工具活动折叠块、diff 查看、资源检视器(Resource Inspector);文件变更统计(工具写文件后自动算 unified diff,展示 `+N/-M`)
- **内建代码索引**:tree-sitter 符号索引(WebAssembly),后台增量索引,`search_symbols` / `find_usages` 通过 MCP 工具暴露给 Agent,侧边栏显示索引状态
- **MCP 集成**:内置 `mcp` 工具桥接(Agent 侧 `mcp` server)、读取项目/用户 MCP 配置、导入 Cursor MCP 配置、服务器启停、一键打开配置文件
- **用量统计**:按 Provider 适配器拉取账户用量(内置 DeepSeek 余额),会话上下文 token / context window 展示
- **会话 Todos**:`todowrite` / `todoread` 工具 + Timeline 内嵌 todo 展示(pi extension 包)
- **模型与思考**:模型切换、思考级别(`off` ~ `max`)、工具 / 技能启停
- **认证**:API Key 与 OAuth 登录、认证状态面板
- **安全**:项目信任确认、命令审批、外链仅放行 http(s)
- **Composer**:↑/↓ 浏览当前会话已提交的消息历史(按会话隔离、光标感知),发送后本地即时回显
- **命令面板**:内置命令白名单(`/compact` `/export` `/copy` `/reload`)+ 扩展命令合并、快捷键一览(Help)与设置对话框
- **品牌与视觉**:`PI Desk` 文字 wordmark、深色 rail、排版系统(Inter + IBM Plex Mono)、Lucide 图标体系

## 技术栈

| 层 | 技术 |
|---|---|
| 主进程 | Electron 43 + [pi-coding-agent](https://github.com/earendil-works/pi) |
| 预加载 | contextBridge(CJS),`contextIsolation` + `sandbox` 开启 |
| 渲染层 | React 19 + electron-vite + Zustand + Zod + Radix UI + lucide-react |
| 渲染 | react-markdown + remark-gfm |
| 代码索引 | web-tree-sitter(TypeScript / JavaScript / Python / Go) |
| 测试 | Vitest + Testing Library(42 文件 / ~355 用例) |

## 架构

```
electron/
  main.ts            主进程:IPC 注册、窗口、应用菜单、外链白名单、userData 迁移
  piHost.ts          pi-coding-agent 桥接层(snapshot / 事件 / 会话生命周期 / 用量)
  indexService.ts    代码索引服务(后台索引 + 状态回调)
  sessionCatalog.ts  会话扫描与目录
  projectCatalog.ts  项目注册表(用户数据目录 projects.json)
  piCommands.ts      内置命令白名单
  providerUsage/     用量适配器(registry + DeepSeek 余额)
  fileChanges.ts     文件变更统计(工具执行前后 diff + 增删行数)
  preload.ts         contextBridge API 暴露
src/
  shared/protocol.ts 主/渲染共享类型 + PiApi 契约
  renderer/          React UI(App / Timeline / SessionSidebar / SessionTabBar / ...)
packages/
  code-index/        符号索引引擎(search_symbols / find_usages,增量刷新)
  code-index-pi-extension/ 将索引暴露为 Agent 侧 MCP 工具的 pi extension
  mcp-bridge/        MCP 配置读取、Cursor 配置导入、服务器启停
  session-todo/      todowrite / todoread 工具 + 状态(pi extension)
docs/superpowers/    设计与规划文档(brand / layout / tabs / provider usage / ...)
```

进程模型:渲染层只通过 `window.pi`(preload 暴露的 `PiApi`)调 IPC;所有会话状态由主进程持有,通过 `pi:event` 推送变更。上下文隔离与沙箱全程开启。

## 开发

```bash
npm install
npm run dev        # electron-vite 热重载
npm run build      # 构建 main / preload / renderer 到 out/
npm run preview    # 预览构建产物
npm test           # vitest
npm run typecheck  # tsc 双配置检查
```

## 数据位置

| 内容 | 路径 |
|---|---|
| 项目注册表 | `~/Library/Application Support/pi-desk/projects.json`(macOS;启动时自动从旧名 `pi-desktop` 迁移) |
| 会话文件 | 由 pi-coding-agent 管理(`~/.pi/agent/sessions/`) |
| MCP 配置 | 项目 `.mcp.json` + 用户级配置(mcp-bridge 合并读取) |
