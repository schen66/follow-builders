[English](README.md) | **中文**

# 追踪建造者，而非网红

一个 AI 驱动的信息聚合工具，追踪 AI 领域最顶尖的建造者——研究员、创始人、产品经理和工程师——并将他们的最新动态整理成易于消化的摘要推送给你。

**理念：** 追踪那些真正在做产品、有独立见解的人，而非只会搬运信息的网红。

## 你会得到什么

每日或每周推送到你常用的通讯工具（Telegram、Discord、WhatsApp 等），包含：

- 顶级 AI 播客新节目的精华摘要
- 26 位精选 AI 建造者在 X/Twitter 上的关键观点和洞察
- AI 公司官方博客的完整文章（Anthropic Engineering、Claude Blog）
- 所有原始内容的链接
- 支持英文、中文或双语版本

## 快速开始

1. 在你的 AI agent 中安装此 skill（OpenClaw 或 Claude Code）
2. 输入 "set up follow builders" 或执行 `/follow-builders`
3. Agent 会以对话方式引导你完成设置——不需要手动编辑任何配置文件

Agent 会询问你：
- 推送频率（每日或每周）和时间
- 语言偏好
- 推送方式（Telegram、邮件或直接在聊天中显示）

不需要任何 API key——所有内容由中心化服务统一抓取。
设置完成后，你的第一期摘要会立即推送。

## 使用 Codex 定时推送到飞书/Lark

本地 Codex Scheduled task 会在每天 **Asia/Shanghai 08:00** 生成并发送完整
中文日报。Codex 使用用户的 ChatGPT/Codex 订阅额度完成内容整理，再由官方
`lark-cli` 投递；不使用 OpenAI API key，也不使用 GitHub Actions 执行日报。
现有中央 feed 和其他 ChatGPT/Agent 消费流程保持不变。

这是本地自动任务：发送时间需要电脑保持唤醒，ChatGPT/Codex 桌面应用保持运行。
任务读取最新公共中央 feed，投递状态只保存在本机，不会提交凭据或接收目标。

### 1. 创建并配置飞书/Lark 应用

1. 在飞书/Lark 开放平台创建企业自建应用，并启用机器人能力。
2. 为机器人开通 `im:message:send_as_bot` 权限，发布应用版本，并确保目标用户在
   应用可用范围内。
3. 如果发到群聊，把机器人加入目标群并确认机器人可以发言。
4. 在应用凭证页面复制 App ID（`cli_xxx`）和 App Secret。

### 2. 获取接收目标 ID

以下目标二选一：

- **群聊：** 使用以 `oc_` 开头的 `chat_id`。机器人加入群后，可运行
  `lark-cli im +chat-search --query "<群名>" --as bot --format json`；也可以在群内
  发送一条会触发 `im.message.receive_v1` 的消息，然后从事件里的
  `event.message.chat_id` 复制。
- **私聊：** 使用以 `ou_` 开头、属于当前应用的用户 `open_id`。让用户先给机器人
  发一条消息，再从开放平台 `im.message.receive_v1` 事件中的
  `event.sender.sender_id.open_id` 复制。`open_id` 与应用绑定，必须使用这个应用
  收到的值。

### 3. 在本机保存投递配置

推荐让官方 CLI 管理 App Secret，避免把密钥写入仓库或任务 prompt：

```bash
lark-cli config init --app-id cli_xxx --app-secret-stdin --brand feishu
```

App Secret 从标准输入读取，不会出现在命令行历史中。若 Codex 的受限运行环境无法读取
macOS 钥匙串，可在确认本机文件权限风险后运行 `lark-cli config keychain-downgrade`；
CLI 会用仅限当前 macOS 用户的本地配置替代钥匙串。

然后在被 Git 忽略的 `.follow-builders-local/config.json` 中只保存非敏感接收目标：

```json
{
  "delivery": {
    "method": "lark",
    "openId": "ou_xxx"
  }
}
```

群聊改用 `"chatId": "oc_xxx"`，二者只能设置一个。国际版 Lark 在本机设置
`LARK_BRAND=lark`。不需要 `OPENAI_API_KEY`。

也兼容旧的 `~/.follow-builders/.env` 方式（绝不要提交该文件）：

```dotenv
LARK_APP_ID=cli_xxx
LARK_APP_SECRET=your_app_secret
# 接收目标二选一：
LARK_CHAT_ID=oc_xxx
# LARK_OPEN_ID=ou_xxx
LARK_BRAND=feishu
```

### 4. 安装并创建定时任务

安装锁定版本的官方 CLI，并验证确定性脚本：

```bash
cd scripts
npm ci
npm test
```

在本仓库创建每天 Asia/Shanghai 08:00 的 Codex Scheduled task。每次运行先执行
`prepare-local-lark-run.js`，读取 `prompts/codex-lark-digest.md` 和生成的
`lark-input.json`，写入完整日报，再执行 `finalize-local-lark-run.js`。

`.follow-builders-local/state-lark.json` 已被 Git 忽略，并与中央 feed 状态分离。
新条目在生成前进入队列，只有发送成功才会清除，因此不会正常重复，也不会因失败
漏发。finalizer 会拒绝遗漏任一原始链接的日报。队列为空时，Codex 发送完全一致的
“今天暂无新的 Builder 更新”。

## 修改设置

通过对话即可修改推送偏好。直接告诉你的 agent：

- "改成每周一早上推送"
- "语言换成中文"
- "把摘要写得更简短一些"
- "显示我当前的设置"

信息源列表（建造者和播客）由中心化统一管理和更新——你无需做任何操作即可获得最新的信息源。

## 自定义摘要风格

Skill 使用纯文本 prompt 文件来控制内容的摘要方式。你可以通过两种方式自定义：

**通过对话（推荐）：**
直接告诉你的 agent——"摘要写得更简练一些"、"多关注可操作的洞察"、"用更轻松的语气"。Agent 会自动帮你更新 prompt。

**直接编辑（高级用户）：**
编辑 `prompts/` 文件夹中的文件：
- `summarize-podcast.md` — 播客节目的摘要方式
- `summarize-tweets.md` — X/Twitter 帖子的摘要方式
- `summarize-blogs.md` — 博客文章的摘要方式
- `digest-intro.md` — 整体摘要的格式和语气
- `translate.md` — 英文内容翻译为中文的方式

这些都是纯文本指令，不是代码。修改后下次推送即生效。

## 默认信息源

### 播客（6个）
- [Latent Space](https://www.youtube.com/@LatentSpacePod)
- [Training Data](https://www.youtube.com/playlist?list=PLOhHNjZItNnMm5tdW61JpnyxeYH5NDDx8)
- [No Priors](https://www.youtube.com/@NoPriorsPodcast)
- [Unsupervised Learning](https://www.youtube.com/@RedpointAI)
- [The MAD Podcast with Matt Turck](https://www.youtube.com/@DataDrivenNYC)
- [AI & I by Every](https://www.youtube.com/playlist?list=PLuMcoKK9mKgHtW_o9h5sGO2vXrffKHwJL)

### X 上的 AI 建造者（26位）
[Andrej Karpathy](https://x.com/karpathy), [Swyx](https://x.com/swyx), [Josh Woodward](https://x.com/joshwoodward), [Boris Cherny](https://x.com/bcherny), [Thibault Sottiaux](https://x.com/thsottiaux), [Peter Yang](https://x.com/petergyang), [Nan Yu](https://x.com/thenanyu), [Madhu Guru](https://x.com/realmadhuguru), [Amanda Askell](https://x.com/AmandaAskell), [Cat Wu](https://x.com/_catwu), [Thariq](https://x.com/trq212), [Google Labs](https://x.com/GoogleLabs), [Amjad Masad](https://x.com/amasad), [Guillermo Rauch](https://x.com/rauchg), [Alex Albert](https://x.com/alexalbert__), [Aaron Levie](https://x.com/levie), [Ryo Lu](https://x.com/ryolu_), [Garry Tan](https://x.com/garrytan), [Matt Turck](https://x.com/mattturck), [Zara Zhang](https://x.com/zarazhangrui), [Nikunj Kothari](https://x.com/nikunj), [Peter Steinberger](https://x.com/steipete), [Dan Shipper](https://x.com/danshipper), [Aditya Agarwal](https://x.com/adityaag), [Sam Altman](https://x.com/sama), [Claude](https://x.com/claudeai)

### 官方博客（2个）
- [Anthropic Engineering](https://www.anthropic.com/engineering) — Anthropic 团队的技术深度文章
- [Claude Blog](https://claude.com/blog) — Claude 的产品公告与更新

## 安装

### OpenClaw
```bash
# 从 ClawhHub 安装（即将上线）
clawhub install follow-builders

# 或手动安装
git clone https://github.com/zarazhangrui/follow-builders.git ~/skills/follow-builders
cd ~/skills/follow-builders/scripts && npm install
```

### Claude Code
```bash
git clone https://github.com/zarazhangrui/follow-builders.git ~/.claude/skills/follow-builders
cd ~/.claude/skills/follow-builders/scripts && npm install
```

## 系统要求

- 一个 AI agent（OpenClaw、Claude Code 或类似工具）
- 网络连接（用于获取中心化 feed）

仅此而已。不需要任何 API key。所有内容（博客文章 + YouTube 字幕 + X/Twitter 帖子）由中心化服务每日抓取更新。

## 工作原理

1. 中心化 feed 每日更新，抓取所有信息源的最新内容（博客文章通过网页抓取，YouTube 字幕通过 Supadata，X/Twitter 通过官方 API）
2. 你的 agent 获取 feed——一次 HTTP 请求，不需要 API key
3. 你的 agent 根据你的偏好将原始内容重新混编为易消化的摘要
4. 摘要推送到你的通讯工具（或直接在聊天中显示）

查看 [examples/sample-digest.md](examples/sample-digest.md) 了解输出示例。

## 隐私

- 不发送任何 API key——所有内容由中心化服务获取
- Telegram/邮件 key 保存在本地 `~/.follow-builders/.env`；飞书凭据优先保存在
  官方 CLI 的本机配置中（也兼容旧的 `.env` 方式）
- Skill 只读取公开内容（公开的博客文章、YouTube 视频和 X 帖子）
- 你的配置、偏好和阅读记录都保留在你自己的设备上

## 许可证

MIT
