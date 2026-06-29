# 家庭组队记账后端部署（Supabase）

组队同步需要后端。本方案用 **Supabase**（免费额度够家庭用，免服务器/备案）。
小程序和 APP 都走 HTTP API，能真正互通。

## 你要做的 4 步（约 15 分钟）

### 第 1 步：注册 Supabase
1. 打开 https://supabase.com 注册（GitHub/邮箱登录都行）
2. 新建项目（New Project），名字随意（如 financehub），记下**区域**（选离你近的，如 Singapore）
3. 设置一个数据库密码（记好，但部署不需要它）
4. 等待 2 分钟项目初始化

### 第 2 步：执行数据库 Schema
1. 进入项目 → 左侧 **SQL Editor** → New query
2. 打开本目录的 `schema.sql`，**全部复制**，粘贴到编辑器
3. 点 **Run**，看到 "Success" 即完成
4. 数据库已具备：用户表、家庭组、共享账本、安全策略

### 第 3 步：拿到 URL 和 Key
1. 左侧 **Settings → API**
2. 找到两个值：
   - **Project URL**（形如 `https://xxxxx.supabase.co`）
   - **anon public key**（很长一串，以 `eyJ` 开头）
3. 把这两个值填到 `cross-platform/src/lib/supabase.ts` 顶部的：
   ```ts
   const SUPABASE_URL = 'https://xxxxx.supabase.co';  // 你的 Project URL
   const SUPABASE_ANON_KEY = 'eyJ...';                // 你的 anon key
   ```
   > anon key 是**公开的**（前端用，安全由 RLS 保证）。**service_role key 绝不能放前端。**

### 第 4 步：配置小程序合法域名（仅小程序需要）
1. 登录微信公众平台 mp.weixin.qq.com
2. 开发管理 → 开发设置 → 服务器域名 → **request 合法域名**
3. 添加你的 Supabase 域名：`https://xxxxx.supabase.co`
4. APP 端（Capacitor）无需此步

## 完成后
- 重新构建：`cd cross-platform && npm run build:h5 && npm run build:weapp`
- 家庭组队功能自动启用（`isSyncEnabled()` 返回 true）
- 进 APP/小程序 → 我的 → 家庭组队记账，即可注册、创建家庭、生成匹配码

## 工作原理
```
家人A 注册账号 → 创建家庭"张家" → 生成匹配码 8K3K9P
家人B 注册账号 → 输入 8K3K9P → 加入"张家"
A 记一笔充电 ¥45 → push 到云端
B 打开 APP → pull → 看到 A 记的 ¥45
```

## 费用
Supabase 免费额度：500MB 数据库 + 50000 月活认证 + 无限 API 请求。
家庭场景（几个人）远用不完，完全免费。

## 安全
- 所有数据行级安全（RLS）：用户只能看自己家庭组的数据
- anon key 公开无害（RLS 拦截）
- 密码由 Supabase Auth 加密存储（bcrypt）
- 软删除：删记录不真删（deleted=true），保证全家同步删除

## 故障排查
| 问题 | 解决 |
|---|---|
| "同步未配置" | URL/key 没填或填错，检查 supabase.ts |
| 注册失败 | Supabase 默认要邮箱验证，可在 Auth 设置里关掉 "Confirm email" |
| 小程序请求失败 | 合法域名没配，见第 4 步 |
| 匹配码无效 | 大小写或空格问题，代码已自动 upper/trim |
