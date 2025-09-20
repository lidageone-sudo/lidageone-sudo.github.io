# 个人藏书网站 (GitHub Pages)

一个纯前端静态站点：展示书籍、搜索、标签过滤、收藏、本地导出收藏数据，适合托管到 GitHub Pages。

## 功能
- 书籍网格展示（`data/books.json`）
- 即时搜索（标题 / 作者 / 标签）
- 标签多选过滤（AND 逻辑）
- 排序：标题 / 年份 / 作者
- 书籍详情：Hash 路由 `#book/<id>` 可直接分享
- 收藏：本地存储（localStorage），支持“只看收藏”
- 导出收藏：生成 `favorites.json`
- 主题切换：深/浅色
- 响应式 + 键盘可访问性（Esc 关闭详情、Tab 导航）

## 使用
1. 克隆或 Fork 本仓库。
2. 修改 `data/books.json` 添加你的书籍条目。
3. 推送后在仓库 Settings -> Pages 启用（分支选择 `main` / 根目录）。
4. 访问 `https://<username>.github.io/<repo>/`。

## 数据格式示例
```json
{
  "id": "unique-id",
  "title": "书名",
  "authors": ["作者A", "作者B"],
  "year": 2024,
  "language": "zh",
  "tags": ["技术", "编程"],
  "isbn": "978xxxxxxxxxx",
  "link": "https://example.com/read",
  "description": "简介文本（支持换行）",
  "cover": "https://.../cover.jpg"
}
```
`id` 应唯一（用于 hash 链接和收藏）；`cover` 可为空；年份可为负表示公元前。

## 自定义
- 样式：编辑 `assets/css/style.css`
- 逻辑：编辑 `assets/js/app.js`
- 添加字段：在 JSON 中加字段并在渲染处补充。

## 收藏同步思路（可选）
- 将导出的 `favorites.json` 重新整合进主 JSON 或做单独列表。
- 若需多设备同步，可改成生成 Gist 方案（需要后端或 GitHub API token）。

## 许可与版权
示例数据包含公共领域作品（Project Gutenberg 等）。请确保你添加的书籍元数据和封面符合版权/使用条款。本项目代码 MIT License。

## 后续扩展建议
- PWA: 添加 manifest.json + service worker 缓存
- 搜索评分/高亮：对命中字段加权
- Markdown 描述：引入 marked.js 解析
- 分页或无限滚动
- JSON Schema 校验 (AJV) + GitHub Actions 自动检查

---
MIT © 2025
