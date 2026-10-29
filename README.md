# dsh-topic-wall

版本 0.3.9 · MIT License

多会话「对话墙」插件：把 DeepSeek Harness 的会话按 **置顶 / 进行中 / 聊天集合** 三段排列成卡片。不进入会话，也能读历史、看状态、处理审批、发下一条消息。

## 功能

**对话墙**
- 三段固定顺序：置顶 → 进行中 → 聊天集合；进行中按首次进入 FIFO。
- 置顶与进行中不互斥：置顶会话运行/等待时同时出现在两段。
- 聊天集合按工作区「空间」分组，组内网格排列，可单独/全部折叠，折叠状态持久化。
- 每卡顶部显示工作区、状态、更新时间，以及该会话独立的模型下拉。

**卡片内聊天**
- 读取真实会话历史，卡内 `session/prompt` 发送、`session/cancel` 停止。
- 自动加载最近 24 小时；更早历史滚到顶部或点「加载更早」再拉，数据不删除。
- 消息左侧 agent、右侧 user；Enter 发送、Shift+Enter 换行，输入法组合状态不误发。
- 图片按钮/拖拽/粘贴，最多 6 张、单张 10MB，历史里显示图片。
- 运行中发送进入宿主队列，可展开、转向、移除、全部转向。
- 连续工具结果折叠成一组，组体只在展开时渲染。
- 审批/单选题直接出现在卡片底部；长审批文字可悬停滚动、点击展开。
- iOS 主题的新消息气泡弹入、按压回弹、输入三点动画；QQ空间是「对方正在输入」蓝色气泡；黑客是终端提示符和绿色方块光标。

**操作**
- 每卡 ⋯ 菜单：打开原会话、重命名（卡内联）、创建分支、归档（带确认）；运行中的会话会再确认「停止并归档」；归档后按 `workspaces.archivedSessionIds` 立即从墙上移除。
- 每个空间组头的「+」：按该空间 workspaceId 新建空会话，不跳转 DSH，新会话进入「进行中」。
- 设置面板：主题风格、边角、列数、空间行数、卡片高度、字号、动效、工具行；实时生效，保存写入 localStorage。
- 运行日志：捕获 window error、未处理 rejection、React 错误、prompt/history/queue/approval/model 异常；设置齿轮红点只表示未读错误。

## 主题

- **iOS**：系统字体、白色圆角卡、iMessage 气泡、毛玻璃、系统蓝；柔和蓝色 mesh 背景 + 细点阵。
- **QQ空间**：蓝白渐变顶栏、圆角白卡、说说式气泡、空间蓝；天空/云层背景。
- **黑客代码**：暗底终端、等宽字体、荧光绿、方角；绿色网格 + 顶部辉光背景。

主题只改表面、字体、边角、消息形态和固定强调色，不改结构。

## 安装

### 本地目录

```sh
dsh plugin --profile desktop add /path/to/dsh-topic-wall
```

或在 DSH **插件 → 添加插件** 里填绝对路径 / tarball。

### Tarball

```sh
dsh plugin --profile desktop add /path/to/dsh-topic-wall-0.3.9.tgz
```

桌面端不加载 Web client HMR。更新 `client.js` 后需要**重启桌面端**；`Cmd+R` 可能仍用旧 bundle。

## 兼容与限制

- 需要当前 DSH 客户端提供 `sessions`、`uiSession`、`uiWorkspace`、`modelDirectories`。
- 图片需要当前模型支持 vision。
- 每卡模型选择作用于该会话；DSH 模型按会话存储。
- 每张卡有独立 ErrorBoundary；单卡渲染异常不会再拖垮整面墙，卡内提供重试/打开/归档。
- 没有自动化 UI 测试；`npm test` 是静态冒烟检查。
- macOS/Electron 的 undici `setTypeOfService EINVAL` 有一个主机侧 guard，默认启用；设 `DSH_TOPIC_WALL_TOS_GUARD=0` 可关闭。

## 开发

```sh
npm test
```

结构：

- `client.js`：浏览器端 main / sidebar.panellist 注册与页面。
- `index.js`：Host 半部与 macOS undici guard。
- `cordis.patch.yml`：bundle insert。
- `locale/*.json`：插件管理器显示名。
- `icon.svg`：插件图标。
- `DESIGN.md`：布局、主题、交互标准。

## License

MIT
