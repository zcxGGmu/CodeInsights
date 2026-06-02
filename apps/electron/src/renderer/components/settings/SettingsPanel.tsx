/**
 * SettingsPanel - 设置面板
 *
 * 顶部 Header（标题 + 关闭按钮）+ 下方（左侧导航 + 右侧 ScrollArea 内容区域）。
 * 使用 Jotai atom 管理当前标签页状态。
 */

import * as React from "react";
import { useAtom, useAtomValue } from "jotai";
import { cn } from "@/lib/utils";
import {
  Settings,
  Radio,
  Palette,
  Info,
  Plug,
  Globe,
  BookOpen,
  Wrench,
  Bot,
  GraduationCap,
  X,
  Keyboard,
  AlertCircle,
  Download,
  Activity,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { settingsTabAtom, channelFormDirtyAtom, settingsCloseRequestedAtom } from "@/atoms/settings-tab";
import type { SettingsTab } from "@/atoms/settings-tab";
import { appModeAtom } from "@/atoms/app-mode";
import { hasUpdateAtom } from "@/atoms/updater";
import { hasEnvironmentIssuesAtom } from "@/atoms/environment";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChannelSettings } from "./ChannelSettings";
import { GeneralSettings } from "./GeneralSettings";
import { ProxySettings } from "./ProxySettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { AboutSettings } from "./AboutSettings";
import { AgentSettings } from "./AgentSettings";
import { PromptSettings } from "./PromptSettings";
import { ToolSettings } from "./ToolSettings";
import { BotHubSettings } from "./BotHubSettings";
import { TutorialViewer } from "../tutorial/TutorialViewer";
import { ShortcutSettings } from "./ShortcutSettings";
import { resolveSettingsNavStatus } from "./settings-ui-model";
import { NativeRuntimeDiagnostics } from "./NativeRuntimeDiagnostics";

/** 设置 Tab 定义 */
interface TabItem {
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
  description: string;
}

/** 基础 Tabs（所有模式都有） */
const BASE_TABS: TabItem[] = [
  { id: "general", label: "通用设置", icon: <Settings size={16} />, description: "用户档案与基础行为" },
  { id: "channels", label: "模型配置", icon: <Radio size={16} />, description: "Provider、模型与凭证" },
  { id: "prompts", label: "提示词管理", icon: <BookOpen size={16} />, description: "系统提示词与模板" },
  { id: "proxy", label: "代理设置", icon: <Globe size={16} />, description: "网络代理与连接" },
];

/** Agent 模式专属 Tab */
const AGENT_TAB: TabItem = {
  id: "agent",
  label: "Agent 配置",
  icon: <Plug size={16} />,
  description: "工作区、MCP 与 Skills",
};
const TOOLS_TAB: TabItem = {
  id: "tools",
  label: "Chat 工具",
  icon: <Wrench size={16} />,
  description: "本地工具与调用能力",
};
const BOTS_TAB: TabItem = {
  id: "bots",
  label: "远程连接",
  icon: <Bot size={16} />,
  description: "外部 Bot 与集成",
};
const TUTORIAL_TAB: TabItem = {
  id: "tutorial",
  label: "使用教程",
  icon: <GraduationCap size={16} />,
  description: "内置引导内容",
};
const SHORTCUTS_TAB: TabItem = {
  id: "shortcuts",
  label: "快捷键管理",
  icon: <Keyboard size={16} />,
  description: "键盘快捷方式",
};

/** 尾部 Tabs */
const TAIL_TABS: TabItem[] = [
  { id: "appearance", label: "外观设置", icon: <Palette size={16} />, description: "主题与显示偏好" },
  { id: "diagnostics", label: "运行诊断", icon: <Activity size={16} />, description: "索引、缓存与 fallback" },
  { id: "about", label: "关于/更新", icon: <Info size={16} />, description: "版本、更新和环境检测" },
];

/** 根据标签页 id 渲染对应内容 */
function renderTabContent(tab: SettingsTab): React.ReactElement {
  switch (tab) {
    case "general":
      return <GeneralSettings />;
    case "channels":
      return <ChannelSettings />;
    case "prompts":
      return <PromptSettings />;
    case "proxy":
      return <ProxySettings />;
    case "agent":
      return <AgentSettings />;
    case "tools":
      return <ToolSettings />;
    case "appearance":
      return <AppearanceSettings />;
    case "diagnostics":
      return <NativeRuntimeDiagnostics />;
    case "about":
      return <AboutSettings />;
    case "bots":
      return <BotHubSettings />;
    case "tutorial":
      return <TutorialViewer />;
    case "shortcuts":
      return <ShortcutSettings />;
  }
}

interface SettingsPanelProps {
  onClose?: () => void;
}

export function SettingsPanel({
  onClose,
}: SettingsPanelProps): React.ReactElement {
  const [activeTab, setActiveTab] = useAtom(settingsTabAtom);
  const channelFormDirty = useAtomValue(channelFormDirtyAtom);
  const [closeRequested, setCloseRequested] = useAtom(settingsCloseRequestedAtom);
  const appMode = useAtomValue(appModeAtom);
  const hasUpdate = useAtomValue(hasUpdateAtom);
  const hasEnvironmentIssues = useAtomValue(hasEnvironmentIssuesAtom);

  /** 统一的退出拦截对话框状态 */
  type PendingAction = { type: 'tab'; tabId: SettingsTab } | { type: 'close' } | null
  const [pendingAction, setPendingAction] = React.useState<PendingAction>(null)
  const showNavDialog = pendingAction !== null

  /** 执行待处理的操作 */
  const executePendingAction = (): void => {
    if (!pendingAction) return
    if (pendingAction.type === 'tab') {
      setActiveTab(pendingAction.tabId)
    } else {
      onClose?.()
    }
    setPendingAction(null)
  }

  /** 取消待处理的操作 */
  const cancelPendingAction = (): void => {
    setPendingAction(null)
  }

  /** 切换标签页时检测是否有未保存内容 */
  const handleTabChange = (tabId: SettingsTab): void => {
    if (tabId === activeTab) return
    if (activeTab === 'channels' && channelFormDirty) {
      setPendingAction({ type: 'tab', tabId })
      return
    }
    setActiveTab(tabId)
  }

  /** 关闭设置面板时检测是否有未保存内容 */
  const handleClose = (): void => {
    if (activeTab === 'channels' && channelFormDirty) {
      setPendingAction({ type: 'close' })
      return
    }
    onClose?.()
  }

  // Cmd+W 等外部关闭请求：弹出确认对话框
  React.useEffect(() => {
    if (closeRequested && activeTab === 'channels') {
      setPendingAction({ type: 'close' })
      setCloseRequested(false)
    }
  }, [closeRequested, activeTab, setCloseRequested])

  // Agent 模式时在渠道后插入 Agent Tab，工具 tab 两种模式都显示
  const tabs = React.useMemo(() => {
    if (appMode === "agent") {
      return [
        ...BASE_TABS,
        AGENT_TAB,
        TOOLS_TAB,
        BOTS_TAB,
        TUTORIAL_TAB,
        SHORTCUTS_TAB,
        ...TAIL_TABS,
      ];
    }
    return [
      ...BASE_TABS,
      TOOLS_TAB,
      BOTS_TAB,
      TUTORIAL_TAB,
      SHORTCUTS_TAB,
      ...TAIL_TABS,
    ];
  }, [appMode]);

  // 当前 tab 标题
  const activeTabLabel = tabs.find((t) => t.id === activeTab)?.label ?? "设置";

  return (
    <div className="flex flex-col h-full">
      {/* 顶部 Header 栏 */}
      <div className="h-12 flex items-center justify-between px-5 border-b border-border/50 flex-shrink-0">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-foreground">
            {activeTabLabel}
          </h2>
        </div>
        {onClose && (
          <button
            onClick={handleClose}
            aria-label="关闭设置"
            className="rounded-md p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* 下方主体：左导航 + 右内容 */}
      <div className="flex flex-1 min-h-0">
        {/* 左侧 Tab 导航 */}
        <div className="w-[176px] border-r border-border/50 pt-3 px-2 flex-shrink-0">
          <nav className="flex flex-col gap-1" aria-label="设置分类">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              const status = resolveSettingsNavStatus({
                tabId: tab.id,
                hasUpdate,
                hasEnvironmentIssues,
              })
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-muted text-foreground font-medium shadow-sm"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <span className="shrink-0">{tab.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{tab.label}</span>
                    <span className="block truncate text-[11px] font-normal text-muted-foreground/80">
                      {tab.description}
                    </span>
                  </span>
                  {status.kind === "issue" && (
                    <span role="img" aria-label={status.label} title={status.label} className="shrink-0 text-status-danger-fg">
                      <AlertCircle size={13} />
                    </span>
                  )}
                  {status.kind === "update" && (
                    <span role="img" aria-label={status.label} title={status.label} className="shrink-0 text-status-running-fg">
                      <Download size={13} />
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* 右侧内容区域 */}
        <ScrollArea className="flex-1">
          <div className="min-w-0 px-6 py-4">{renderTabContent(activeTab)}</div>
        </ScrollArea>
      </div>

      {/* 退出拦截弹窗（侧边栏导航 / X 关闭 / Cmd+W） */}
      <AlertDialog open={showNavDialog} onOpenChange={(open) => { if (!open) cancelPendingAction() }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>放弃未保存的更改？</AlertDialogTitle>
            <AlertDialogDescription>
              当前渠道配置尚未保存，确定要离开吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelPendingAction}>留在当前页</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={executePendingAction}>放弃并离开</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
