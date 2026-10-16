# 拾光账本

一个不依赖第三方包的个人收支记账系统。前端使用原生 HTML、CSS 和 JavaScript，后端使用 Node.js 内置 HTTP 模块，账目保存在本地 JSON 文件中。

## 启动

需要 Node.js 18 或更新版本。

在项目目录运行：

    npm start

默认在 http://localhost:3000 提供页面和 API。可以用 PORT 环境变量更改端口。

## 功能

- 新增收入和支出，记录用途、金额、分类和日期
- 查看累计结余、本月收入和本月支出
- 按收入或支出筛选，并删除账目
- 账目保存在 data/transactions.json；这个运行时数据目录不会提交到 Git

## API

- GET /api/health：服务健康状态
- GET /api/transactions：列出账目
- POST /api/transactions：新增账目
- DELETE /api/transactions/:id：删除账目

新增请求示例：

    {
      "type": "expense",
      "description": "午餐",
      "amount": 32.5,
      "category": "餐饮",
      "date": "2026-10-16"
    }
