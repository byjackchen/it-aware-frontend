# AI-Oriented Chat Home 设计文档

## 1. 文档信息
- 文档路径：`specs/chat_ui_design/README.md`
- 版本：`v1`
- 状态：`Draft`
- 日期：`2026-02-09`
- 适用项目：`it-aware-frontend`（Next.js App Router）

## 2. 背景与问题定义

当前项目的主路由首页 `app/(main)/page.tsx` 处于空白状态，AI 入口以右下角抽屉 `components/layout/ChatbotDrawer.tsx` 存在。  
这会带来三个问题：

1. 首页无法回答“我现在最该做什么”。
2. Chat 被放在边缘位置，无法承担“工作入口”的角色。
3. 任务、洞察、快速操作分散在系统各处，用户仍需理解模块结构才能推进工作。

目标不是做一个“聊天页面”，而是构建一个 **AI 驱动的工作入口（Front Door）**：
- Chat 是意图入口
- Action 是执行单元
- Status 是反馈闭环

## 3. 设计目标与非目标

## 3.1 设计目标（Goals）
1. 首页首屏明确展示“当前最重要任务”与“下一步动作”。
2. AI 输出结构化且可执行（每条输出可直接触发 action）。
3. 支持“对话 + 任务 + 洞察 + 快捷入口 + 记忆上下文”一体化体验。
4. 在不破坏现有导航/主题/i18n 架构下，完成渐进式改造。

## 3.2 非目标（Non-goals）
1. 不在首版重构整个全站信息架构（仅重构 Home 入口体验）。
2. 不在首版实现全自动 Agent 流程编排（先做人机协同）。
3. 不在首版替换所有传统页面（保留明确 Quick Actions 和模块入口）。

## 4. 设计原则（落地版）

1. Task-first：优先展示“可完成事项”，不是系统能力清单。
2. Actionable AI：AI 结果必须附带下一步动作按钮。
3. Progressive Disclosure：默认展示必要信息，深层解释按需展开。
4. Low Cognitive Load：减少并列决策点，控制每屏信息密度。
5. Predictable Path：保留快捷入口，避免“只能问 AI”。

## 5. 页面信息架构（Home IA）

Home 由 5 个核心区块组成：

1. `AIInputBar`（主入口）
- 功能：接收自然语言意图、触发任务启动、支持快捷短语。
- 要点：输入框常驻（sticky），提供建议提示词 chips。

2. `ActionCards`（今日任务）
- 功能：展示可完成任务与状态（待处理/进行中/已完成/阻塞）。
- 要点：每张卡必须含主 CTA（例如“立即审批”“查看详情”）。

3. `AISuggestions`（AI 洞察建议）
- 功能：异常提醒、趋势洞察、风险提示。
- 要点：默认折叠为摘要卡；点击后展开解释与建议动作。

4. `QuickActions`（快捷任务入口）
- 功能：高频动作直达（新建、审批、上传、跳转模块页）。
- 要点：可预测路径，降低“全靠聊天”的不确定性。

5. `ContextHistory`（上下文记忆）
- 功能：展示最近对话与 AI 已完成事项，支持一键复用。
- 要点：作为“持续在线助理”的可见记忆层。

## 6. 布局策略（Desktop / Mobile）

## 6.1 Desktop（>=1280）
- 顶部：`AIInputBar`（sticky，宽度受容器限制）。
- 主区：`ActionCards`（左 8 列） + `AISuggestions`（右 4 列）。
- 次区：`QuickActions`（横向卡片） + `ContextHistory`（纵向列表）。

## 6.2 Tablet（768-1279）
- `AIInputBar` 顶部常驻。
- `ActionCards` 与 `AISuggestions` 纵向堆叠。
- `QuickActions` 2 列网格，`ContextHistory` 底部列表。

## 6.3 Mobile（<768）
- 单列流式布局。
- `AIInputBar` 固定顶部，输入区高度受控。
- 卡片操作按钮优先展示主 CTA，次操作收纳菜单。

## 7. 关键交互规范

1. 输入提交后：
- 先出现“AI 正在处理”占位卡（skeleton + thinking 文案）。
- 返回后以“结构化响应卡”替代纯文字长气泡。

2. 结构化响应卡模板：
- `summary`: 一句话结论
- `facts`: 2-4 条关键点
- `actions`: 1-3 个可点击动作

3. 任务卡状态流转：
- `pending -> in_progress -> done`
- 异常流：`pending/in_progress -> blocked`

4. 洞察卡展开策略：
- 默认仅显示 `title + severity + suggested action`
- 展开后显示解释、影响范围、推荐下一步

5. 记忆卡复用：
- 点击历史项可自动回填输入框（可编辑后发送）

## 8. 前端组件拆分（建议）

建议新增目录：`components/home/`

1. `AIHomePage.tsx`（页面容器）
2. `AIInputBar.tsx`
3. `ActionCardsSection.tsx`
4. `ActionCard.tsx`
5. `AISuggestionsSection.tsx`
6. `InsightCard.tsx`
7. `QuickActionsSection.tsx`
8. `ContextHistorySection.tsx`
9. `StructuredResponseCard.tsx`
10. `HomeSectionHeader.tsx`

建议类型定义：`lib/types/home.ts`

## 9. 数据模型（首版）

```ts
type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';
type InsightSeverity = 'info' | 'warning' | 'critical';

interface AIAction {
  id: string;
  label: string;
  actionType: 'navigate' | 'mutation' | 'analysis' | 'export';
  href?: string;
  payload?: Record<string, unknown>;
}

interface ActionTaskCard {
  id: string;
  title: string;
  status: TaskStatus;
  owner?: string;
  dueAt?: string;
  reason?: string; // why this is prioritized now
  primaryAction: AIAction;
  secondaryActions?: AIAction[];
}

interface InsightCard {
  id: string;
  title: string;
  severity: InsightSeverity;
  summary: string;
  details?: string;
  suggestedAction?: AIAction;
}

interface MemoryItem {
  id: string;
  type: 'conversation' | 'task';
  title: string;
  subtitle?: string;
  createdAt: string;
  reusablePrompt?: string;
}
```

## 10. 与当前代码基座的映射

1. 路由入口
- 将 `app/(main)/page.tsx` 从空白页替换为 `AIHomePage`。

2. 布局兼容
- 保持 `app/(main)/layout.tsx` 不变（沿用 `TopBar` + `MainContent`）。
- 首版保留 `ChatbotDrawer` 作为 fallback，后续可改为“最小助手模式”。

3. 主题兼容
- 复用 `app/globals.css` 现有变量（`--card-bg`、`--border-color` 等）。
- 新样式优先使用现有 utility（`glass-dark` 等），避免引入新风格割裂。

4. i18n 兼容
- 在 `messages/en.json`、`messages/zh.json` 新增 `HomeAI` 命名空间。

## 11. 文案与 i18n 规划（建议键位）

```json
{
  "HomeAI": {
    "inputPlaceholder": "Ask AI to help you complete today’s work...",
    "sections": {
      "tasks": "Today’s Actions",
      "insights": "AI Insights",
      "quickActions": "Quick Actions",
      "memory": "Recent Context"
    },
    "status": {
      "pending": "Pending",
      "inProgress": "In Progress",
      "done": "Done",
      "blocked": "Blocked"
    },
    "buttons": {
      "viewDetails": "View Details",
      "startAnalysis": "Start Analysis",
      "reuse": "Reuse"
    }
  }
}
```

## 12. 技术实施计划（分阶段）

## Phase 0：定义与占位（0.5 天）
1. 创建 `specs/chat_ui_design/README.md`（本文件）。
2. 确认首版数据来源：mock 还是已有 API。
3. 锁定首版 KPI 与验收口径。

## Phase 1：静态结构落地（1-2 天）
1. 新建 `components/home/*` 组件骨架。
2. 完成 Home 五大区块布局（响应式）。
3. 在 `app/(main)/page.tsx` 接入新首页。

交付标准：
- 无真实 AI 数据也可完整展示页面结构与状态样例。

## Phase 2：交互与状态管理（1-2 天）
1. 接入输入、提交、loading、错误态。
2. 实现任务卡状态切换与动作按钮回调。
3. 实现建议卡展开/收起、历史卡复用填充。

交付标准：
- 用户可从输入到任务动作形成闭环（mock 数据驱动）。

## Phase 3：AI 与业务接口接入（2-4 天）
1. 抽象 `HomeAIService`（可先走 `/app/api/*` 代理层）。
2. 将 AI 输出标准化为 `summary/facts/actions` 结构。
3. 将任务列表与洞察列表接入真实数据源。

交付标准：
- 关键流程可在真实数据下稳定运行，失败有可恢复提示。

## Phase 4：监控、优化与灰度（1-2 天）
1. 埋点：输入提交率、首个动作点击率、任务完成率。
2. 性能：首屏渲染、交互延迟、错误率。
3. 灰度开关：按用户组或环境控制发布范围。

交付标准：
- 有可对比的改版前后行为指标。

## 13. 验收标准（MVP）

1. 首页首屏可见以下 5 区块：输入、任务、洞察、快捷入口、上下文。
2. 任一 AI 输出都包含至少一个可执行动作。
3. 用户可在 30 秒内完成一次“输入 -> 得到建议 -> 执行动作”流程。
4. 移动端单列布局可用，核心 CTA 可触达。
5. 中英文文案均可正常切换。

## 14. 指标体系（建议）

1. Activation
- `home_ai_input_submit_rate`
- `home_quick_action_click_rate`

2. Efficiency
- `time_to_first_action`（进入首页到首次动作点击）
- `task_completion_rate_same_session`

3. Quality
- `ai_response_actionable_rate`（有可执行 action 的响应占比）
- `home_error_rate`（请求/渲染/交互）

## 15. 风险与缓解

1. 风险：页面过度聊天化，任务完成率下降  
缓解：任务卡与快捷入口始终可见，Chat 不独占主视图。

2. 风险：AI 输出不可预测，用户不信任  
缓解：结构化响应 + 明确来源/下一步 + 可回退的传统路径。

3. 风险：信息噪音过高导致认知负担  
缓解：默认摘要展示，采用渐进披露，限制每区块首屏数量。

4. 风险：与现有视觉风格割裂  
缓解：复用现有 theme token 与 glass 体系，避免另起一套风格系统。

## 16. 开放问题（实施前需确认）

1. 首版任务卡的数据主来源是哪个域（Auth/Data/Knowledge/Persona）？
2. AI 建议需要展示“依据数据来源”吗（用于提升可信度）？
3. `ChatbotDrawer` 在新首页发布后是保留、降级，还是替换为快捷入口？
4. 是否需要按权限裁剪不同角色可见的 Quick Actions？

## 17. 结论

本方案将首页从“空白页 + 边缘聊天抽屉”升级为“AI + Task + Status 的统一工作入口”，路径是渐进改造、低风险接入，且与当前代码结构兼容。  
可直接按 Phase 1 开始前端实现。
