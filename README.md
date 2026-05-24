# PairPlan

情侣共享计划 PWA：共同日历、一起做、愿望清单、下一次见面倒计时、约会计划。

## Setup

1. 创建 Supabase 项目。
2. 在 SQL Editor 运行 `supabase/schema.sql`。
3. 在 Authentication 设置里开启 Email magic link。
4. 发布或打开 PairPlan。
5. 填入 Supabase Project URL 和 anon public key。

## Realtime

A 添加数据后，B 的页面会通过 Supabase Realtime 自动刷新。

## Local preview

```bash
python3 -m http.server 4200
```

打开：

```text
http://localhost:4200/pair-plan/
```
