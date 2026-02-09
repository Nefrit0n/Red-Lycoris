import { useEffect, useMemo, useState } from "react";
import type { DashboardTemplate, WidgetPlacement } from "../types";
import { dashboardTemplates, defaultTemplateId } from "../layouts/templates";

const STORAGE_KEY = "red_lycoris_dashboard_v2_layout";
const STORAGE_VERSION = 1;

interface StoredLayout {
  version: number;
  templateId: string;
  layout: WidgetPlacement[];
}

const getTemplateById = (id: string) =>
  dashboardTemplates.find((template) => template.id === id) ??
  dashboardTemplates.find((template) => template.id === defaultTemplateId) ??
  dashboardTemplates[0];

const loadStoredLayout = (): StoredLayout | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredLayout;
    if (parsed.version !== STORAGE_VERSION || !parsed.layout?.length) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const persistLayout = (templateId: string, layout: WidgetPlacement[]) => {
  if (typeof window === "undefined") {
    return;
  }
  const payload: StoredLayout = {
    version: STORAGE_VERSION,
    templateId,
    layout,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const useDashboardLayout = () => {
  const stored = useMemo(loadStoredLayout, []);
  const initialTemplate = stored ? getTemplateById(stored.templateId) : getTemplateById(defaultTemplateId);
  const initialLayout = stored?.layout ?? initialTemplate.layout;

  const [selectedTemplate, setSelectedTemplate] = useState<DashboardTemplate>(initialTemplate);
  const [layout, setLayout] = useState<WidgetPlacement[]>(initialLayout);
  const [savedLayout, setSavedLayout] = useState<WidgetPlacement[]>(initialLayout);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!stored) {
      persistLayout(initialTemplate.id, initialLayout);
    }
  }, [initialLayout, initialTemplate.id, stored]);

  const startEditing = () => {
    setLayout(savedLayout);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setLayout(savedLayout);
    setIsEditing(false);
  };

  const saveLayout = () => {
    setSavedLayout(layout);
    setIsEditing(false);
    persistLayout(selectedTemplate.id, layout);
  };

  const applyTemplate = (templateId: string) => {
    const nextTemplate = getTemplateById(templateId);
    setSelectedTemplate(nextTemplate);
    setLayout(nextTemplate.layout);
    setSavedLayout(nextTemplate.layout);
    setIsEditing(false);
    persistLayout(nextTemplate.id, nextTemplate.layout);
  };

  const resetLayout = () => {
    setLayout(selectedTemplate.layout);
    setSavedLayout(selectedTemplate.layout);
    setIsEditing(false);
    persistLayout(selectedTemplate.id, selectedTemplate.layout);
  };

  const updateLayout = (nextLayout: WidgetPlacement[]) => {
    setLayout(nextLayout);
  };

  // Check if current layout differs from saved layout
  const hasUnsavedChanges = useMemo(() => {
    if (!isEditing) return false;
    if (layout.length !== savedLayout.length) return true;
    return layout.some((item, index) => {
      const saved = savedLayout[index];
      return (
        item.widgetId !== saved?.widgetId ||
        item.x !== saved?.x ||
        item.y !== saved?.y ||
        item.w !== saved?.w ||
        item.h !== saved?.h
      );
    });
  }, [isEditing, layout, savedLayout]);

  return {
    templates: dashboardTemplates,
    selectedTemplate,
    layout,
    isEditing,
    hasUnsavedChanges,
    startEditing,
    cancelEditing,
    saveLayout,
    applyTemplate,
    resetLayout,
    updateLayout,
  };
};
