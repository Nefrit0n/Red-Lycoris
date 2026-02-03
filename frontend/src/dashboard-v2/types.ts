import type { ReactNode } from "react";

export type WidgetCategory =
  | "Executive"
  | "Risk"
  | "Engineering"
  | "Operations"
  | "AppSec"
  | "DevSecOps";

export interface WidgetSize {
  w: number;
  h: number;
}

export interface WidgetPlacement extends WidgetSize {
  widgetId: string;
  x: number;
  y: number;
}

export interface WidgetDataState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export interface WidgetDefinition<T = unknown> {
  id: string;
  title: string;
  description: string;
  category: WidgetCategory;
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  getData: () => WidgetDataState<T>;
  render: (data: T) => ReactNode;
  linkTo?: string;
  pinnable?: boolean;
}

export interface DashboardTemplate {
  id: string;
  role: string;
  description: string;
  layout: WidgetPlacement[];
}
