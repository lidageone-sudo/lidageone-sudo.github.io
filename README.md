# AI 导航站 (静态版)

聚合「大模型 / 开源模型 / 视觉生成 / 语音 / 推理部署 / 框架 / 评测 / 工具 / 模板」等多类别资源的纯静态导航页面。所有数据来自本仓库 `data/models.json`，前端纯原生 JS 渲染，可直接部署到 GitHub Pages。

## 功能
* 关键词搜索（支持名称/描述/标签 & 简易拼音首字母）
* 分类筛选 / 许可证筛选 / 标签(Top 40 频次) 组合过滤
* 排序：推荐得分 / 名称 / 最近更新 / Stars
* 收藏（本地 LocalStorage）
* 详情侧栏：基础信息 + 链接聚合
* 明亮 / 暗黑主题切换 + 宽松 / 紧凑布局切换
* 纯静态（仅一次请求 models.json），方便二次扩展

## 数据结构 (`data/models.json`)
```jsonc
{
  "id": "meta-llama-3-8b",             // 唯一 ID
  "name": "Llama 3 8B",                // 名称
  "description": "...",                // 描述
  "category": "开源模型",              // 主分类（用于分类筛选）
  "license": "LLAMA 3",               // 许可证
  "stars": 120000,                     // （可选）GitHub Stars 或估值
  "updated": "2025-05-01T00:00:00Z",   // ISO 时间，用于“最近更新”排序
  "tags": ["open-source","chat"],      // 标签（用于 AND 过滤 + 侧栏展示）
  "vendor": "Meta",                    // （可选）供应商 / 组织
  "params": "8B",                      // （可选）参数规模
  "size": "13GB",                      // （可选）模型磁盘大小
  "links": {                            // 外部链接集合（存在的会展示）
    "repo": "https://github.com/...",
    "homepage": "...",
    "doc": "...",
    "demo": "..."
  }
}
```

## 本地开发 / 预览
GitHub Pages 直接静态托管即可，如需本地查看：
```bash
python -m http.server 8080
# 或 Node
npx serve .
```
浏览器访问 http://localhost:8080

## 自定义与扩展
| 需求 | 修改位置 |
| ---- | -------- |
| 新增条目 | `data/models.json` 追加对象 |
| 增加显示字段 | `assets/js/app.js` 中 `buildCard` / `openPanel` |
| 调整推荐权重 | `enrich()` 函数中 score 计算逻辑 |
| 标签数量上限 | `buildFacetOptions()` 中 slice(0,40) |
| 主题配色 | `assets/css/style.css :root` & `[data-theme=dark]` |

## 推荐分类建议（可按需增改）
* 大模型 (API)
* 开源模型
* 视觉生成
* 语音
* 推理部署
* 开发框架
* 评测与对比
* 应用模板
* AI 工具 / Agent / 数据处理

## 后续可选增强
* Service Worker 缓存与离线
* JSON Schema 校验 & 构建脚本自动抓取 stars
* 多关键字 / 高级查询语法 (tag:xxx license:MIT)
* 收藏导出 / 导入
* 数据分区 lazy load（按分类拆分多个 JSON）
* 星标实时刷新（调用 GitHub API，需要后端或 serverless 代理）

## 许可
前端代码示例以 MIT 授权。模型与第三方项目的商标 / 许可证均归其原作者所有，遵循各自的协议。

---
欢迎 Fork & 扩展数据集。# Retro Reader 📱📖

一个纯前端、本地文件读取的复古（iPhone 4s 拟物风）电子书阅读器。支持导入 **TXT / EPUB**，不上传服务器，全部处理在浏览器内。适合直接托管在 GitHub Pages / 任何静态空间。

## 主要特性
- 本地导入：选择 txt / epub 文件即时阅读，文件内容不会被上传。
- TXT 自动分章：基于常见章节标题（“第X章”“Chapter N”“Part N”）解析；未匹配章节会合并到上一个章节。
- EPUB 渲染：使用 [epub.js](https://github.com/futurepress/epub.js) 生成分页视图与目录。
- 三主题循环：`light → sepia → dark`，模拟旧纸质与夜间阅读。
- 字号调节：12–36px，自动持久化。
- 进度记忆：TXT 保存（章节 index + 滚动偏移）；EPUB 保存 CFI；刷新回到上次阅读位置。
- 键盘快捷键：←/→ 切换章节，Esc 返回书架。
- 复古 UI：皮革标题栏、拟物按钮、纸张纹理、古早状态条时间与电量模拟。

## 使用方法
1. 打开站点主页（`index.html`）。
2. 点击 “导入” 按钮选择本地 txt 或 epub 文件，可多选。
3. 书架中点击某本书进入阅读；再次点击底部 Home（椭圆）或“书架”返回。
4. 章节下拉快速跳转；A-/A+ 调整字号；“↺” 回到本章顶部 / 重新显示首章。
5. 主题按钮循环切换主题，偏好会保存。

## 项目结构
```
index.html           # 主页面（阅读器）
assets/css/reader.css
assets/js/reader.js
README.md
```

## 安全与隐私
- 所有文件只存在于内存 File 对象中；未调用任何上传接口。
- 仅使用 localStorage 保存：主题、字号、阅读进度（按文件名+大小派生的 id）。
- 清理浏览器数据或更改文件名/大小会重置进度。

## TXT 分章规则
默认正则（简化说明）：
```
^(第[\d一二三四五六七八九十百千]+[章节回卷])|(Chapter\s+\d+)|(Part\s+\d+)
```
满足：
1. 行匹配标题模式
2. 上一章节累积字数达到阈值（避免误切）

可在 `reader.js` 内调整解析逻辑以适配不同格式小说。

## 可扩展方向
- PWA：添加 `manifest.json` + Service Worker 本地缓存框架资源。
- 批注/高亮：Range + 序列化偏移存储。
- 分页（TXT）：按视口高度分割为虚拟“页”，支持左右翻页动画。
- 目录编辑：允许手动合并/拆分章节。
- 云同步：使用 WebDAV / GitHub Gist 保存进度（需用户 Token）。

## 依赖
- epub.js（CDN 引入），其他所有逻辑原生实现。无构建步骤。

## 许可证
MIT © 2025

> 注意：请确保你导入的电子书符合版权法规，仅供个人学习与研究。本项目不提供任何受版权保护内容。 
