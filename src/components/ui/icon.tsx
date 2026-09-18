"use client";

import * as React from "react";
import {
  Activity, AlarmClock, Apple, Award, BatteryLow, Bell, BookmarkPlus, CalendarCheck, ChartLine, Check,
  ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, CloudOff, CloudUpload, Dumbbell,
  Download, Droplets, Flame, Flag, Heart, HeartPulse, Info, LayoutDashboard, LogOut, Medal, Menu,
  MessageCircle, MessagesSquare, Mic, Moon, Mountain, PersonStanding, Plus, Rocket, ScrollText,
  Search, SendHorizontal, Settings, Shield, ShoppingBag, ShoppingCart, Shuffle, Smartphone,
  Sparkles, Sun, Sunrise, Target, Timer, Trash2, TriangleAlert, Trophy, Undo2, User, UserPlus,
  Users, X, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EsiFit Icon wrapper — one family (Lucide), explicit static registry so the
 * client bundle stays tree-shaken (no dynamic whole-library import).
 * Sizes: 16 / 20 / 24 / 32 (DESIGN_BIBLE §6). Default stroke 1.75.
 */

const REGISTRY = {
  Activity, AlarmClock, Apple, Award, BatteryLow, Bell, BookmarkPlus, CalendarCheck, ChartLine, Check,
  ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, CloudOff, CloudUpload, Dumbbell,
  Download, Droplets, Flame, Flag, Heart, HeartPulse, Info, LayoutDashboard, LogOut, Medal, Menu,
  MessageCircle, MessagesSquare, Mic, Moon, Mountain, PersonStanding, Plus, Rocket, ScrollText,
  Search, SendHorizontal, Settings, Shield, ShoppingBag, ShoppingCart, Shuffle, Smartphone,
  Sparkles, Sun, Sunrise, Target, Timer, Trash2, TriangleAlert, Trophy, Undo2, User, UserPlus,
  Users, X, Zap,
} as const;

export type IconName = keyof typeof REGISTRY;

/** Exposed for registry-completeness tests (not part of the public UI API). */
export const ICON_REGISTRY_KEYS = Object.keys(REGISTRY) as IconName[];

const SIZES = { 16: 16, 20: 20, 24: 24, 32: 32 } as const;

/** Kebab-case aliases (badge icon slugs from the domain model). */
const ALIASES: Record<string, IconName> = {
  "calendar-check": "CalendarCheck",
  "award": "Award",
  "medal": "Medal",
  "target": "Target",
  "flame": "Flame",
  "flag": "Flag",
  "mountain": "Mountain",
  "rocket": "Rocket",
  "sunrise": "Sunrise",
  "droplets": "Droplets",
  "apple": "Apple",
  "zap": "Zap",
  "trophy": "Trophy",
  "activity": "Activity",
  "user": "User",
  "dumbbell": "Dumbbell",
  "alarm-clock": "AlarmClock",
  "send": "SendHorizontal",
  "cart": "ShoppingCart",
  "trash": "Trash2",
  "heart-pulse": "HeartPulse",
  "clipboard-list": "ClipboardList",
  "triangle-alert": "TriangleAlert",
  "person-standing": "PersonStanding",
  "shield": "Shield",
  "shuffle": "Shuffle",
  "scroll-text": "ScrollText",
};

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  /** Named tokens (16/20/24/32) or any explicit pixel size. */
  size?: keyof typeof SIZES | number;
  strokeWidth?: number;
  label?: string;
}

export function Icon({ name, size = 20, strokeWidth = 1.75, label, className, ...rest }: IconProps) {
  const px = typeof size === "number" ? size : SIZES[size] ?? 20;
  const resolved = ALIASES[name] ?? (REGISTRY[name as IconName] ? (name as IconName) : undefined);
  if (!resolved) return null;
  const Component = REGISTRY[resolved];
  return (
    <Component
      size={px}
      strokeWidth={strokeWidth}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      className={cn(className)}
      {...rest}
    />
  );
}
