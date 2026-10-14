import { CategoryManager } from '@/components/CategoryManager';

/** "עריכת תקציב משתנות": variable spending budgets and access to the expense list. */
export default function VariableBudgetsScreen() {
  return <CategoryManager kind="variable" />;
}
