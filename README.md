# KaraCar · 车载K歌

在特斯拉浏览器里唱 K 的网页应用，功能对标 naru711.com（SingLoud）：

| 功能 | 说明 |
|---|---|
| 搜索任意歌曲 | 直接搜 YouTube，无需 API Key（可选配置 `YT_API_KEY`，只返回允许嵌入播放的视频） |
| 同步歌词 | **逐字**（酷狗 KRC）＋ **逐行**（LRCLIB），自动按视频时长挑选最匹配的版本 |
| 点行同步 | 点击任意一行歌词 = 把这一行对齐到当前时间；也可 ±0.5 秒微调，每首歌单独记住 |
| 三种显示模式 | 视频（底部字幕）/ 歌词（大字滚动）/ 卡拉OK（全屏两行 KTV 风格，控制栏自动隐藏） |
| 行驶中 | 车辆暂停视频时自动切到歌词模式并继续播放音频 |
| 歌单 | 多歌单、全部播放、随机播放、一键获取全部歌词 |
| 队列 | 接下来 / 插播 / 上移下移 / 自动连播 |
| 乘客扫码点歌 | 二维码 30 分钟有效，乘客手机免登录点歌、插播，实时出现在车机队列 |
| 热门歌曲 | 华语 / 经典 / 粤语 / 日语 / 韩语 / 英文 精选 |
| 五语界面 | English、简体中文、繁體中文、日本語、한국어 |
| 多设备同步 | 8 位同步码，在电脑/手机上整理歌单，车上直接用 |

## 本地运行

需要 Node.js 18+，没有任何依赖包：

```bash
node server.js
```

打开 http://localhost:8080 。

## 部署到公网（车上必须用 HTTPS 网址打开）

**Render（免费）**：把这个文件夹推到 GitHub → Render 新建 Web Service → Build Command 留空，Start Command 填 `node server.js`。
注意免费版闲置会休眠、磁盘不持久（同步码数据会丢）；要长期保存可加一块 Persistent Disk 并设 `DATA_DIR=/data`。

**或者用自己电脑 + Cloudflare Tunnel**：

```bash
cloudflared tunnel --url http://localhost:8080
```

环境变量：

- `PORT` — 端口，默认 8080
- `YT_API_KEY` — 可选，YouTube Data API v3 Key
- `DATA_DIR` — 同步码数据存放目录，默认 `./data`

## 在特斯拉上使用

1. 停车 → 打开车机浏览器 → 输入你的网址。
2. 设置 → 「特斯拉全屏」可通过 YouTube 跳转隐藏地址栏。
3. 有些官方 MV 禁止外部播放，会自动跳过；搜索时加上「KTV」「歌词」更容易找到可播放的版本。

## 安全

- 代码里没有任何密钥。可选的 `YT_API_KEY` 只通过环境变量传入，不要写进代码或提交到仓库。
- 服务器自带按 IP 的限流（搜索/歌词每分钟 40 次等）、房间和同步码数量上限，以及安全响应头（CSP 等）。
- 自建部署请放在反向代理后面（Render、Cloudflare Tunnel 等），不要把家里电脑的端口直接暴露到公网；限流依赖代理传来的 `cf-connecting-ip` 头。
- 发现安全问题请通过 GitHub 的私密漏洞报告（Security → Report a vulnerability）告诉我们，不要公开提 issue。

## 许可证

[AGPL-3.0](LICENSE)。可以自由使用、修改、自建；但如果你把修改后的版本作为网络服务提供给别人，必须同样公开源代码。

本项目与 Tesla, Inc.、YouTube、酷狗、LRCLIB 均无关联。视频由 YouTube 官方嵌入播放器播放；歌词版权归原作者所有。

## 文件结构

```
server.js          API：YouTube 搜索、歌词（酷狗/LRCLIB）、乘客房间（SSE）、歌单同步
public/index.html  车机端
public/app.js      播放器、歌词引擎、队列、歌单、乘客房间
public/guest.html  乘客手机点歌页
public/i18n.js     五语文案
public/hot.js      热门歌曲
```
