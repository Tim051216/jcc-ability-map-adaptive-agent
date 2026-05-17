export type ViewType = 'overview' | 'governance' | 'operations' | 'compliance' | 'monitoring' | 'management';

export interface NavItem {
  id: ViewType;
  label: string;
  icon: string;
}
